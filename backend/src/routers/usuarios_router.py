"""Usuarios CRUD endpoints with permissions management."""

import hashlib
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..auth import require_permission, require_admin

router = APIRouter()


class UsuarioCreate(BaseModel):
    nombre: str
    correo: str
    rol: str
    password: str
    activo: bool = True
    permisos: Optional[dict] = {}


class UsuarioUpdate(BaseModel):
    nombre: str
    correo: str
    rol: str
    password: Optional[str] = None
    activo: bool = True
    permisos: Optional[dict] = {}


def _get_user_permissions(conn, user_id: int) -> dict:
    rows = conn.execute(
        """SELECT p.modulo, up.lectura, up.escritura, up.actualizacion, up.eliminacion
           FROM usuario_permisos up
           JOIN permisos p ON p.id = up.permiso_id
           WHERE up.usuario_id = ?""",
        (user_id,),
    ).fetchall()
    perms = {}
    for r in rows:
        perms[r["modulo"]] = {
            "lectura": bool(r["lectura"]),
            "escritura": bool(r["escritura"]),
            "actualizacion": bool(r["actualizacion"]),
            "eliminacion": bool(r["eliminacion"]),
        }
    return perms


def _save_permissions(conn, user_id: int, permisos: dict):
    conn.execute("DELETE FROM usuario_permisos WHERE usuario_id=?", (user_id,))
    permisos_rows = conn.execute("SELECT id, modulo FROM permisos").fetchall()
    modulo_to_id = {r["modulo"]: r["id"] for r in permisos_rows}

    for modulo, perm_values in permisos.items():
        permiso_id = modulo_to_id.get(modulo)
        if not permiso_id:
            continue
        conn.execute(
            """INSERT INTO usuario_permisos (usuario_id, permiso_id, lectura, escritura, actualizacion, eliminacion)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, permiso_id,
             int(perm_values.get("lectura", False)),
             int(perm_values.get("escritura", False)),
             int(perm_values.get("actualizacion", False)),
             int(perm_values.get("eliminacion", False))),
        )


@router.get("")
def list_usuarios(user=Depends(require_permission("usuarios", "lectura"))):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, nombre, correo, rol, activo, created_at FROM usuarios ORDER BY nombre"
        ).fetchall()
        result = []
        for r in rows:
            u = dict(r)
            u["permisos"] = _get_user_permissions(conn, u["id"])
            result.append(u)
        return result


@router.get("/{user_id}")
def get_usuario(user_id: int, user=Depends(require_permission("usuarios", "lectura"))):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, nombre, correo, rol, activo, created_at FROM usuarios WHERE id=?",
            (user_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        u = dict(row)
        u["permisos"] = _get_user_permissions(conn, u["id"])
        return u


@router.post("")
def create_usuario(data: UsuarioCreate, user=Depends(require_admin)):
    password_hash = hashlib.sha256(data.password.encode()).hexdigest()
    with get_db() as conn:
        try:
            cursor = conn.execute(
                """INSERT INTO usuarios (nombre, correo, rol, password_hash, activo)
                   VALUES (?, ?, ?, ?, ?)""",
                (data.nombre, data.correo, data.rol, password_hash, int(data.activo)),
            )
        except Exception:
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
        new_id = cursor.lastrowid
        if data.permisos:
            _save_permissions(conn, new_id, data.permisos)
        return {"id": new_id, "message": "Usuario creado"}


@router.put("/{user_id}")
def update_usuario(user_id: int, data: UsuarioUpdate, user=Depends(require_admin)):
    with get_db() as conn:
        if data.password:
            password_hash = hashlib.sha256(data.password.encode()).hexdigest()
            conn.execute(
                """UPDATE usuarios SET nombre=?, correo=?, rol=?, password_hash=?, activo=?
                   WHERE id=?""",
                (data.nombre, data.correo, data.rol, password_hash, int(data.activo), user_id),
            )
        else:
            conn.execute(
                """UPDATE usuarios SET nombre=?, correo=?, rol=?, activo=?
                   WHERE id=?""",
                (data.nombre, data.correo, data.rol, int(data.activo), user_id),
            )
        if data.permisos is not None:
            _save_permissions(conn, user_id, data.permisos)
        return {"message": "Usuario actualizado"}


@router.delete("/{user_id}")
def delete_usuario(user_id: int, user=Depends(require_admin)):
    with get_db() as conn:
        # Prevent deleting yourself
        if user_id == user["id"]:
            raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
        result = conn.execute("DELETE FROM usuarios WHERE id=?", (user_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return {"message": "Usuario eliminado"}
