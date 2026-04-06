"""Pacientes CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..auth import require_permission

router = APIRouter()


class PacienteCreate(BaseModel):
    nombre: str
    apellido_paterno: str
    apellido_materno: Optional[str] = None
    fecha_nacimiento: str
    sexo: str
    direccion: Optional[str] = None
    telefono_contacto: Optional[str] = None
    responsable: Optional[str] = None


@router.get("")
def list_pacientes(
    search: str = "",
    page: int = 1,
    limit: int = 50,
    user=Depends(require_permission("pacientes", "lectura")),
):
    offset = (page - 1) * limit
    with get_db() as conn:
        if search:
            q = f"%{search}%"
            where = """WHERE (nombre || ' ' || COALESCE(apellido_paterno,'') || ' ' || COALESCE(apellido_materno,'')) LIKE ?
                   OR nombre LIKE ? OR apellido_paterno LIKE ?
                   OR apellido_materno LIKE ? OR CAST(id AS TEXT) LIKE ?"""
            params = (q, q, q, q, q)
            count = conn.execute(
                f"SELECT COUNT(*) FROM pacientes {where}", params,
            ).fetchone()[0]
            rows = conn.execute(
                f"SELECT * FROM pacientes {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (*params, limit, offset),
            ).fetchall()
        else:
            count = conn.execute("SELECT COUNT(*) FROM pacientes").fetchone()[0]
            rows = conn.execute(
                "SELECT * FROM pacientes ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return {"data": [dict(r) for r in rows], "total": count, "page": page, "limit": limit}


@router.get("/{paciente_id}")
def get_paciente(paciente_id: int, user=Depends(require_permission("pacientes", "lectura"))):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM pacientes WHERE id = ?", (paciente_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return dict(row)


@router.post("")
def create_paciente(data: PacienteCreate, user=Depends(require_permission("pacientes", "escritura"))):
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO pacientes (nombre, apellido_paterno, apellido_materno,
               fecha_nacimiento, sexo, direccion, telefono_contacto, responsable)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.nombre, data.apellido_paterno, data.apellido_materno,
             data.fecha_nacimiento, data.sexo, data.direccion,
             data.telefono_contacto, data.responsable),
        )
        return {"id": cursor.lastrowid, "message": "Paciente creado"}


@router.put("/{paciente_id}")
def update_paciente(paciente_id: int, data: PacienteCreate, user=Depends(require_permission("pacientes", "actualizacion"))):
    with get_db() as conn:
        result = conn.execute(
            """UPDATE pacientes SET nombre=?, apellido_paterno=?, apellido_materno=?,
               fecha_nacimiento=?, sexo=?, direccion=?, telefono_contacto=?, responsable=?
               WHERE id=?""",
            (data.nombre, data.apellido_paterno, data.apellido_materno,
             data.fecha_nacimiento, data.sexo, data.direccion,
             data.telefono_contacto, data.responsable, paciente_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return {"message": "Paciente actualizado"}


@router.delete("/{paciente_id}")
def delete_paciente(paciente_id: int, user=Depends(require_permission("pacientes", "eliminacion"))):
    with get_db() as conn:
        result = conn.execute("DELETE FROM pacientes WHERE id=?", (paciente_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        return {"message": "Paciente eliminado"}
