"""JWT authentication helpers."""

import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

SECRET_KEY = os.environ.get("SECRET_KEY", "historial-pediatrico-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.environ.get("TOKEN_EXPIRE_HOURS", "24"))

security = HTTPBearer()


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
        return {"id": int(user_id), "rol": payload.get("rol"), "nombre": payload.get("nombre")}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")


def _get_user_permissions(user_id: int) -> dict:
    """Fetch permissions from DB for a given user."""
    from .database import get_db
    with get_db() as conn:
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


def require_permission(modulo: str, tipo: str = "lectura"):
    """FastAPI dependency that checks a specific permission for the current user.

    Usage in a router:
        @router.post("")
        def create_something(user=Depends(require_permission("pacientes", "escritura"))):
            ...
    """
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        perms = _get_user_permissions(user["id"])
        mod_perms = perms.get(modulo, {})
        if not mod_perms.get(tipo, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tienes permiso de {tipo} en {modulo}",
            )
        return user
    return dependency


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Restrict endpoint to admin users only."""
    if user["rol"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores pueden realizar esta acción",
        )
    return user
