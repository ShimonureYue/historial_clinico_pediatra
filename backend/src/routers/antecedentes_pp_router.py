"""Antecedentes Personales Patológicos CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..auth import require_permission

router = APIRouter()


class AntecedentePPCreate(BaseModel):
    paciente_id: int
    enfermedades_exantematicas: Optional[str] = None
    alergias: Optional[str] = None
    cirugias: Optional[str] = None
    otros: Optional[str] = None


class AntecedentePPUpdate(BaseModel):
    enfermedades_exantematicas: Optional[str] = None
    alergias: Optional[str] = None
    cirugias: Optional[str] = None
    otros: Optional[str] = None


@router.get("/paciente/{paciente_id}")
def get_by_paciente(paciente_id: int, user=Depends(require_permission("antecedentes_pp", "lectura"))):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM antecedentes_personales_patologicos WHERE paciente_id=?",
            (paciente_id,),
        ).fetchone()
        if not row:
            return None
        return dict(row)


@router.post("")
def create(data: AntecedentePPCreate, user=Depends(require_permission("antecedentes_pp", "escritura"))):
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO antecedentes_personales_patologicos
               (paciente_id, enfermedades_exantematicas, alergias, cirugias, otros)
               VALUES (?, ?, ?, ?, ?)""",
            (data.paciente_id, data.enfermedades_exantematicas,
             data.alergias, data.cirugias, data.otros),
        )
        return {"id": cursor.lastrowid, "message": "Antecedentes patológicos creados"}


@router.put("/{record_id}")
def update(record_id: int, data: AntecedentePPUpdate, user=Depends(require_permission("antecedentes_pp", "actualizacion"))):
    with get_db() as conn:
        result = conn.execute(
            """UPDATE antecedentes_personales_patologicos
               SET enfermedades_exantematicas=?, alergias=?, cirugias=?, otros=?
               WHERE id=?""",
            (data.enfermedades_exantematicas, data.alergias, data.cirugias, data.otros, record_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Registro no encontrado")
        return {"message": "Antecedentes patológicos actualizados"}
