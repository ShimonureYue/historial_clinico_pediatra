"""Authentication endpoints."""

import hashlib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_db
from ..auth import create_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    correo: str
    password: str


@router.post("/login")
def login(req: LoginRequest):
    password_hash = hashlib.sha256(req.password.encode()).hexdigest()

    with get_db() as conn:
        user = conn.execute(
            "SELECT id, nombre, correo, rol, activo FROM usuarios WHERE correo = ? AND password_hash = ?",
            (req.correo, password_hash),
        ).fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        if not user["activo"]:
            raise HTTPException(status_code=403, detail="Usuario inactivo")

        # Fetch permissions
        perms_rows = conn.execute(
            """SELECT p.modulo, up.lectura, up.escritura, up.actualizacion, up.eliminacion
               FROM usuario_permisos up
               JOIN permisos p ON p.id = up.permiso_id
               WHERE up.usuario_id = ?""",
            (user["id"],),
        ).fetchall()

        permissions = {}
        for row in perms_rows:
            permissions[row["modulo"]] = {
                "lectura": bool(row["lectura"]),
                "escritura": bool(row["escritura"]),
                "actualizacion": bool(row["actualizacion"]),
                "eliminacion": bool(row["eliminacion"]),
            }

        token = create_access_token({
            "sub": str(user["id"]),
            "rol": user["rol"],
            "nombre": user["nombre"],
        })

        return {
            "access_token": token,
            "user": {
                "id": user["id"],
                "nombre": user["nombre"],
                "correo": user["correo"],
                "rol": user["rol"],
            },
            "permissions": permissions,
        }
