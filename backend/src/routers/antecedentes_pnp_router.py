"""Antecedentes Personales No Patológicos CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..auth import require_permission

router = APIRouter()


class InmunizacionData(BaseModel):
    vacuna: str
    dosis: Optional[str] = None
    fecha_aplicacion: Optional[str] = None
    lote: Optional[str] = None
    observaciones: Optional[str] = None


class AntecedentePNPCreate(BaseModel):
    paciente_id: int
    producto_gesta: Optional[str] = None
    tipo_nacimiento: Optional[str] = None
    peso_nacer_kg: Optional[float] = None
    talla_nacer_cm: Optional[float] = None
    seno_materno: Optional[bool] = False
    inicio_formula_meses: Optional[int] = None
    tipo_sangre: Optional[str] = None
    apgar: Optional[str] = None
    ablactacion: Optional[str] = None
    alimentacion: Optional[str] = None
    zoonosis: Optional[str] = None
    lugar_nacimiento: Optional[str] = None
    lugar_residencia: Optional[str] = None
    respiro_al_nacer: Optional[int] = None
    lloro_al_nacer: Optional[int] = None
    desarrollo_psicomotor: Optional[str] = None
    inmunizaciones: list[InmunizacionData] = []


class AntecedentePNPUpdate(BaseModel):
    producto_gesta: Optional[str] = None
    tipo_nacimiento: Optional[str] = None
    peso_nacer_kg: Optional[float] = None
    talla_nacer_cm: Optional[float] = None
    seno_materno: Optional[bool] = False
    inicio_formula_meses: Optional[int] = None
    tipo_sangre: Optional[str] = None
    apgar: Optional[str] = None
    ablactacion: Optional[str] = None
    alimentacion: Optional[str] = None
    zoonosis: Optional[str] = None
    lugar_nacimiento: Optional[str] = None
    lugar_residencia: Optional[str] = None
    respiro_al_nacer: Optional[int] = None
    lloro_al_nacer: Optional[int] = None
    desarrollo_psicomotor: Optional[str] = None
    inmunizaciones: list[InmunizacionData] = []


def _get_inmunizaciones(conn, anp_id: int) -> list:
    rows = conn.execute(
        "SELECT * FROM inmunizaciones WHERE antecedentes_np_id=? ORDER BY fecha_aplicacion",
        (anp_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _save_inmunizaciones(conn, anp_id: int, inmunizaciones: list[InmunizacionData]):
    conn.execute("DELETE FROM inmunizaciones WHERE antecedentes_np_id=?", (anp_id,))
    for inm in inmunizaciones:
        conn.execute(
            """INSERT INTO inmunizaciones (antecedentes_np_id, vacuna, dosis, fecha_aplicacion, lote, observaciones)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (anp_id, inm.vacuna, inm.dosis, inm.fecha_aplicacion or None, inm.lote, inm.observaciones),
        )


@router.get("/paciente/{paciente_id}")
def get_by_paciente(paciente_id: int, user=Depends(require_permission("antecedentes_pnp", "lectura"))):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM antecedentes_personales_no_patologicos WHERE paciente_id=?",
            (paciente_id,),
        ).fetchone()
        if not row:
            return None
        result = dict(row)
        result["inmunizaciones"] = _get_inmunizaciones(conn, result["id"])
        return result


@router.post("")
def create(data: AntecedentePNPCreate, user=Depends(require_permission("antecedentes_pnp", "escritura"))):
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO antecedentes_personales_no_patologicos
               (paciente_id, producto_gesta, tipo_nacimiento, peso_nacer_kg, talla_nacer_cm,
                seno_materno, inicio_formula_meses, tipo_sangre, apgar,
                ablactacion, alimentacion, zoonosis, lugar_nacimiento, lugar_residencia,
                respiro_al_nacer, lloro_al_nacer, desarrollo_psicomotor)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.paciente_id, data.producto_gesta, data.tipo_nacimiento,
             data.peso_nacer_kg, data.talla_nacer_cm, int(data.seno_materno or 0),
             data.inicio_formula_meses, data.tipo_sangre, data.apgar,
             data.ablactacion, data.alimentacion, data.zoonosis,
             data.lugar_nacimiento, data.lugar_residencia,
             data.respiro_al_nacer, data.lloro_al_nacer, data.desarrollo_psicomotor),
        )
        anp_id = cursor.lastrowid
        _save_inmunizaciones(conn, anp_id, data.inmunizaciones)
        return {"id": anp_id, "message": "Antecedentes no patológicos creados"}


@router.put("/{record_id}")
def update(record_id: int, data: AntecedentePNPUpdate, user=Depends(require_permission("antecedentes_pnp", "actualizacion"))):
    with get_db() as conn:
        result = conn.execute(
            """UPDATE antecedentes_personales_no_patologicos
               SET producto_gesta=?, tipo_nacimiento=?, peso_nacer_kg=?, talla_nacer_cm=?,
                   seno_materno=?, inicio_formula_meses=?, tipo_sangre=?, apgar=?,
                   ablactacion=?, alimentacion=?, zoonosis=?,
                   lugar_nacimiento=?, lugar_residencia=?,
                   respiro_al_nacer=?, lloro_al_nacer=?, desarrollo_psicomotor=?
               WHERE id=?""",
            (data.producto_gesta, data.tipo_nacimiento,
             data.peso_nacer_kg, data.talla_nacer_cm, int(data.seno_materno or 0),
             data.inicio_formula_meses, data.tipo_sangre, data.apgar,
             data.ablactacion, data.alimentacion, data.zoonosis,
             data.lugar_nacimiento, data.lugar_residencia,
             data.respiro_al_nacer, data.lloro_al_nacer, data.desarrollo_psicomotor,
             record_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Registro no encontrado")
        _save_inmunizaciones(conn, record_id, data.inmunizaciones)
        return {"message": "Antecedentes no patológicos actualizados"}
