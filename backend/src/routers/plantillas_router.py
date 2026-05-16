"""Plantillas de receta CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..auth import get_current_user

router = APIRouter()


class PlantillaCreate(BaseModel):
    nombre: str
    notas_receta: Optional[str] = None
    notas_adicionales: Optional[str] = None


@router.get("")
def list_plantillas(_user=Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, nombre, notas_receta, notas_adicionales, created_at, updated_at "
            "FROM plantillas_receta ORDER BY nombre COLLATE NOCASE"
        ).fetchall()
        return [dict(r) for r in rows]


@router.get("/{plantilla_id}")
def get_plantilla(plantilla_id: int, _user=Depends(get_current_user)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM plantillas_receta WHERE id=?", (plantilla_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return dict(row)


@router.post("")
def create_plantilla(data: PlantillaCreate, _user=Depends(get_current_user)):
    if not data.nombre.strip():
        raise HTTPException(status_code=400, detail="El nombre es requerido")
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO plantillas_receta (nombre, notas_receta, notas_adicionales) VALUES (?, ?, ?)",
            (data.nombre.strip(), data.notas_receta, data.notas_adicionales),
        )
        return {"id": cursor.lastrowid, "message": "Plantilla creada"}


@router.put("/{plantilla_id}")
def update_plantilla(plantilla_id: int, data: PlantillaCreate, _user=Depends(get_current_user)):
    if not data.nombre.strip():
        raise HTTPException(status_code=400, detail="El nombre es requerido")
    with get_db() as conn:
        result = conn.execute(
            "UPDATE plantillas_receta SET nombre=?, notas_receta=?, notas_adicionales=?, "
            "updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (data.nombre.strip(), data.notas_receta, data.notas_adicionales, plantilla_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        return {"message": "Plantilla actualizada"}


@router.delete("/{plantilla_id}")
def delete_plantilla(plantilla_id: int, _user=Depends(get_current_user)):
    with get_db() as conn:
        result = conn.execute("DELETE FROM plantillas_receta WHERE id=?", (plantilla_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Plantilla no encontrada")
        return {"message": "Plantilla eliminada"}
