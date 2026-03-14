"""Antecedentes Heredo Familiares CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..auth import require_permission

router = APIRouter()


class AntecedenteHFCreate(BaseModel):
    paciente_id: int
    abuelo_paterno: Optional[str] = None
    abuela_paterna: Optional[str] = None
    abuelo_materno: Optional[str] = None
    abuela_materna: Optional[str] = None
    padre: Optional[str] = None
    madre: Optional[str] = None
    hermanos: Optional[str] = None


class AntecedenteHFUpdate(BaseModel):
    abuelo_paterno: Optional[str] = None
    abuela_paterna: Optional[str] = None
    abuelo_materno: Optional[str] = None
    abuela_materna: Optional[str] = None
    padre: Optional[str] = None
    madre: Optional[str] = None
    hermanos: Optional[str] = None


@router.get("/paciente/{paciente_id}")
def get_by_paciente(paciente_id: int, user=Depends(require_permission("antecedentes_hf", "lectura"))):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM antecedentes_heredo_familiares WHERE paciente_id=?",
            (paciente_id,),
        ).fetchone()
        if not row:
            return None
        return dict(row)


@router.post("")
def create(data: AntecedenteHFCreate, user=Depends(require_permission("antecedentes_hf", "escritura"))):
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO antecedentes_heredo_familiares
               (paciente_id, abuelo_paterno, abuela_paterna, abuelo_materno,
                abuela_materna, padre, madre, hermanos)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.paciente_id, data.abuelo_paterno, data.abuela_paterna,
             data.abuelo_materno, data.abuela_materna,
             data.padre, data.madre, data.hermanos),
        )
        return {"id": cursor.lastrowid, "message": "Antecedentes heredo familiares creados"}


@router.put("/{record_id}")
def update(record_id: int, data: AntecedenteHFUpdate, user=Depends(require_permission("antecedentes_hf", "actualizacion"))):
    with get_db() as conn:
        result = conn.execute(
            """UPDATE antecedentes_heredo_familiares
               SET abuelo_paterno=?, abuela_paterna=?, abuelo_materno=?,
                   abuela_materna=?, padre=?, madre=?, hermanos=?
               WHERE id=?""",
            (data.abuelo_paterno, data.abuela_paterna, data.abuelo_materno,
             data.abuela_materna, data.padre, data.madre, data.hermanos,
             record_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Registro no encontrado")
        return {"message": "Antecedentes heredo familiares actualizados"}
