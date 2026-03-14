"""Tratamientos (medicamentos por consulta) CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from ..database import get_db
from ..auth import require_permission

router = APIRouter()


class TratamientoCreate(BaseModel):
    consulta_id: int
    nombre_medicamento: str
    presentacion: Optional[str] = None
    dosificacion: Optional[str] = None
    duracion: Optional[str] = None
    via_administracion: Optional[str] = None
    cantidad_surtir: Optional[str] = None


class TratamientoBulk(BaseModel):
    consulta_id: int
    tratamientos: List[TratamientoCreate]


@router.get("/consulta/{consulta_id}")
def list_tratamientos(consulta_id: int, user=Depends(require_permission("consultas", "lectura"))):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM tratamientos WHERE consulta_id=? ORDER BY id",
            (consulta_id,),
        ).fetchall()
        return [dict(r) for r in rows]


@router.post("")
def create_tratamiento(data: TratamientoCreate, user=Depends(require_permission("consultas", "escritura"))):
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO tratamientos
               (consulta_id, nombre_medicamento, presentacion, dosificacion,
                duracion, via_administracion, cantidad_surtir)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (data.consulta_id, data.nombre_medicamento, data.presentacion,
             data.dosificacion, data.duracion, data.via_administracion,
             data.cantidad_surtir),
        )
        return {"id": cursor.lastrowid, "message": "Tratamiento creado"}


@router.put("/bulk/{consulta_id}")
def bulk_update_tratamientos(consulta_id: int, data: List[TratamientoCreate], user=Depends(require_permission("consultas", "actualizacion"))):
    """Replace all tratamientos for a consulta."""
    with get_db() as conn:
        conn.execute("DELETE FROM tratamientos WHERE consulta_id=?", (consulta_id,))
        for t in data:
            conn.execute(
                """INSERT INTO tratamientos
                   (consulta_id, nombre_medicamento, presentacion, dosificacion,
                    duracion, via_administracion, cantidad_surtir)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (consulta_id, t.nombre_medicamento, t.presentacion,
                 t.dosificacion, t.duracion, t.via_administracion,
                 t.cantidad_surtir),
            )
        return {"message": "Tratamientos actualizados"}


@router.delete("/{tratamiento_id}")
def delete_tratamiento(tratamiento_id: int, user=Depends(require_permission("consultas", "eliminacion"))):
    with get_db() as conn:
        result = conn.execute("DELETE FROM tratamientos WHERE id=?", (tratamiento_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Tratamiento no encontrado")
        return {"message": "Tratamiento eliminado"}
