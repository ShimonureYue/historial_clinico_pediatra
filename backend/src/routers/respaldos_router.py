"""Backup management: S3 upload, restore, and install from presigned URL."""

import os
import sqlite3
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import get_current_user
from ..database import DB_PATH, get_db

router = APIRouter()

# ── Config (reads from os.environ, loaded from .env by main.py) ───────────────

def _load_config() -> dict | None:
    """Read S3 config from environment variables. Returns None if incomplete."""
    config = {
        "AWS_ACCESS_KEY_ID": os.environ.get("AWS_ACCESS_KEY_ID", ""),
        "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
        "S3_BACKUP_BUCKET": os.environ.get("S3_BACKUP_BUCKET", ""),
        "S3_BACKUP_PREFIX": os.environ.get("S3_BACKUP_PREFIX", ""),
        "AWS_DEFAULT_REGION": os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
    }
    required = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BACKUP_BUCKET", "S3_BACKUP_PREFIX"]
    if not all(config.get(k) for k in required):
        return None
    return config


def _get_s3_client(config: dict):
    """Create a boto3 S3 client with explicit credentials."""
    try:
        import boto3
    except ImportError:
        raise HTTPException(status_code=500, detail="boto3 no está instalado. Ejecuta: pip install boto3")
    return boto3.client(
        "s3",
        aws_access_key_id=config["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=config["AWS_SECRET_ACCESS_KEY"],
        region_name=config.get("AWS_DEFAULT_REGION", "us-east-1"),
    )


# ── Ensure table exists ──────────────────────────────────────────────────────

def _ensure_table():
    """Create the respaldos table if it doesn't exist (safe for production DB)."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS respaldos (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre_archivo  TEXT    NOT NULL,
                s3_key          TEXT    NOT NULL,
                tamano_bytes    INTEGER NOT NULL,
                fecha_respaldo  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)


_ensure_table()


# ── Models ────────────────────────────────────────────────────────────────────

class InstalarRequest(BaseModel):
    url: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status(_user=Depends(get_current_user)):
    """Check if S3 backup is configured."""
    config = _load_config()
    has_boto3 = True
    try:
        import boto3  # noqa: F401
    except ImportError:
        has_boto3 = False

    # Report which specific vars are missing
    missing = []
    if not has_boto3:
        missing.append("boto3 no instalado (pip install boto3)")
    if not config:
        for var in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BACKUP_BUCKET", "S3_BACKUP_PREFIX"]:
            if not os.environ.get(var):
                missing.append(var)

    return {
        "configured": config is not None and has_boto3,
        "has_config": config is not None,
        "has_boto3": has_boto3,
        "bucket": config["S3_BACKUP_BUCKET"] if config else None,
        "prefix": config["S3_BACKUP_PREFIX"] if config else None,
        "missing": missing,
    }


@router.get("/ultimo")
def get_ultimo(_user=Depends(get_current_user)):
    """Get info about the last successful backup."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, nombre_archivo, s3_key, tamano_bytes, fecha_respaldo FROM respaldos ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if not row:
        return {"exists": False}
    return {
        "exists": True,
        "id": row["id"],
        "nombre_archivo": row["nombre_archivo"],
        "s3_key": row["s3_key"],
        "tamano_bytes": row["tamano_bytes"],
        "fecha_respaldo": row["fecha_respaldo"],
    }


@router.post("/backup")
def create_backup(_user=Depends(get_current_user)):
    """Create a SQLite snapshot and upload to S3."""
    config = _load_config()
    if not config:
        raise HTTPException(status_code=400, detail="Backup S3 no configurado. Crea el archivo backup_config.env")

    s3 = _get_s3_client(config)
    bucket = config["S3_BACKUP_BUCKET"]
    prefix = config["S3_BACKUP_PREFIX"]

    now = datetime.now(timezone.utc)
    filename = f"historial_pediatrico_{now.strftime('%Y-%m-%d_%H%M%S')}.db"
    s3_key = f"{prefix}/{filename}"

    tmp_path = None
    try:
        # 1. Safe SQLite snapshot (WAL-mode safe)
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
        os.close(tmp_fd)

        source = sqlite3.connect(DB_PATH)
        dest = sqlite3.connect(tmp_path)
        source.backup(dest)
        dest.close()
        source.close()

        file_size = os.path.getsize(tmp_path)

        # 2. Upload to S3
        s3.upload_file(
            tmp_path,
            bucket,
            s3_key,
            ExtraArgs={"ServerSideEncryption": "AES256"},
        )

        # 3. Record in local DB
        with get_db() as conn:
            conn.execute(
                "INSERT INTO respaldos (nombre_archivo, s3_key, tamano_bytes) VALUES (?, ?, ?)",
                (filename, s3_key, file_size),
            )

        return {
            "message": "Respaldo creado exitosamente",
            "nombre_archivo": filename,
            "s3_key": s3_key,
            "tamano_bytes": file_size,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear respaldo: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/restaurar")
def restaurar_backup(_user=Depends(get_current_user)):
    """Download the last backup from S3 and replace the local database."""
    config = _load_config()
    if not config:
        raise HTTPException(status_code=400, detail="Backup S3 no configurado")

    # Get last backup info
    with get_db() as conn:
        row = conn.execute(
            "SELECT s3_key, nombre_archivo FROM respaldos ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No hay respaldos registrados")

    s3 = _get_s3_client(config)
    bucket = config["S3_BACKUP_BUCKET"]
    s3_key = row["s3_key"]

    tmp_path = None
    try:
        # 1. Download from S3
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
        os.close(tmp_fd)
        s3.download_file(bucket, s3_key, tmp_path)

        # 2. Validate it's a SQLite file
        with open(tmp_path, "rb") as f:
            header = f.read(16)
        if not header.startswith(b"SQLite format 3"):
            raise HTTPException(status_code=400, detail="El archivo descargado no es una base de datos SQLite válida")

        # 3. Replace local DB
        _replace_database(tmp_path)

        return {
            "message": "Base de datos restaurada exitosamente",
            "archivo": row["nombre_archivo"],
            "nota": "Reinicia el servidor para que los cambios surtan efecto",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al restaurar: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/instalar")
def instalar_desde_url(data: InstalarRequest, _user=Depends(get_current_user)):
    """Download a DB from a presigned URL and replace the local database."""
    url = data.url.strip()
    if not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="La URL debe empezar con https://")

    tmp_path = None
    try:
        # 1. Download from presigned URL
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
        os.close(tmp_fd)
        urllib.request.urlretrieve(url, tmp_path)

        # 2. Validate it's a SQLite file
        with open(tmp_path, "rb") as f:
            header = f.read(16)
        if not header.startswith(b"SQLite format 3"):
            raise HTTPException(status_code=400, detail="El archivo descargado no es una base de datos SQLite válida")

        file_size = os.path.getsize(tmp_path)

        # 3. Replace local DB
        _replace_database(tmp_path)

        return {
            "message": "Base de datos instalada exitosamente desde la nube",
            "tamano_bytes": file_size,
            "nota": "Reinicia el servidor para que los cambios surtan efecto",
        }

    except HTTPException:
        raise
    except urllib.error.URLError as e:
        raise HTTPException(status_code=400, detail=f"No se pudo descargar: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al instalar: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _replace_database(new_db_path: str):
    """Replace the current database with a new file. Creates a local backup first."""
    import shutil

    db_dir = os.path.dirname(DB_PATH)
    backup_dir = os.path.join(db_dir, "backups")
    os.makedirs(backup_dir, exist_ok=True)

    # Local backup before replacing
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    local_backup = os.path.join(backup_dir, f"pre_restore_{timestamp}.db")
    shutil.copy2(DB_PATH, local_backup)

    # Remove WAL/SHM files if they exist
    for ext in ["-wal", "-shm"]:
        wal_path = DB_PATH + ext
        if os.path.exists(wal_path):
            os.unlink(wal_path)

    # Replace
    shutil.copy2(new_db_path, DB_PATH)
