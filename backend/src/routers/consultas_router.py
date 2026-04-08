"""Consultas CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..auth import require_permission

router = APIRouter()


class ConsultaCreate(BaseModel):
    paciente_id: int
    fecha_consulta: str
    padecimiento_actual: str
    impresion_diagnostica: Optional[str] = None
    plan_tratamiento: Optional[str] = None
    notas_adicionales: Optional[str] = None
    notas_receta: Optional[str] = None
    # Mediciones
    peso_kg: Optional[float] = None
    talla_cm: Optional[float] = None
    fc_bpm: Optional[int] = None
    fr_rpm: Optional[int] = None
    temperatura_c: Optional[float] = None
    ta_sistolica: Optional[int] = None
    ta_diastolica: Optional[int] = None
    cabeza: Optional[str] = None
    cuello: Optional[str] = None
    torax: Optional[str] = None
    abdomen: Optional[str] = None
    miembros_toracicos: Optional[str] = None
    miembros_pelvicos: Optional[str] = None
    otros: Optional[str] = None


def _enrich_consulta(conn, consulta: dict) -> dict:
    """Add patient name and mediciones to a consulta dict."""
    pac = conn.execute(
        "SELECT nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo FROM pacientes WHERE id=?",
        (consulta["paciente_id"],),
    ).fetchone()
    if pac:
        consulta["paciente_nombre"] = f"{pac['nombre']} {pac['apellido_paterno']} {pac['apellido_materno'] or ''}".strip()
        consulta["paciente_fecha_nacimiento"] = pac["fecha_nacimiento"]
        consulta["paciente_sexo"] = pac["sexo"]

    med = conn.execute(
        "SELECT * FROM consultas_mediciones WHERE consulta_id=?",
        (consulta["id"],),
    ).fetchone()
    consulta["mediciones"] = dict(med) if med else None

    tratamientos = conn.execute(
        "SELECT * FROM tratamientos WHERE consulta_id=? ORDER BY id",
        (consulta["id"],),
    ).fetchall()
    consulta["tratamientos"] = [dict(t) for t in tratamientos]

    # Alergias from antecedentes patologicos
    app = conn.execute(
        "SELECT alergias FROM antecedentes_personales_patologicos WHERE paciente_id=?",
        (consulta["paciente_id"],),
    ).fetchone()
    consulta["alergias"] = app["alergias"] if app and app["alergias"] else None

    # Previous consultation's weight/height + tratamientos
    prev = conn.execute(
        """SELECT c.id, cm.peso_kg, cm.talla_cm, c.fecha_consulta
           FROM consultas c
           JOIN consultas_mediciones cm ON cm.consulta_id = c.id
           WHERE c.paciente_id=? AND c.id < ? AND (cm.peso_kg IS NOT NULL OR cm.talla_cm IS NOT NULL)
           ORDER BY c.fecha_consulta DESC, c.id DESC LIMIT 1""",
        (consulta["paciente_id"], consulta["id"]),
    ).fetchone()
    if prev:
        prev_trats = conn.execute(
            "SELECT * FROM tratamientos WHERE consulta_id=? ORDER BY id",
            (prev["id"],),
        ).fetchall()
        consulta["consulta_anterior"] = {
            "peso_kg": prev["peso_kg"],
            "talla_cm": prev["talla_cm"],
            "fecha": prev["fecha_consulta"],
            "tratamientos": [dict(t) for t in prev_trats],
        }
    else:
        consulta["consulta_anterior"] = None

    return consulta


@router.get("")
def list_consultas(
    search: str = "",
    page: int = 1,
    limit: int = 50,
    user=Depends(require_permission("consultas", "lectura")),
):
    offset = (page - 1) * limit
    with get_db() as conn:
        if search:
            q = f"%{search}%"
            count = conn.execute(
                """SELECT COUNT(*) FROM consultas c
                   LEFT JOIN pacientes p ON p.id = c.paciente_id
                   WHERE c.padecimiento_actual LIKE ? OR c.impresion_diagnostica LIKE ?
                   OR c.fecha_consulta LIKE ?
                   OR (p.nombre || ' ' || p.apellido_paterno || ' ' || COALESCE(p.apellido_materno,'')) LIKE ?""",
                (q, q, q, q),
            ).fetchone()[0]
            rows = conn.execute(
                """SELECT c.* FROM consultas c
                   LEFT JOIN pacientes p ON p.id = c.paciente_id
                   WHERE c.padecimiento_actual LIKE ? OR c.impresion_diagnostica LIKE ?
                   OR c.fecha_consulta LIKE ?
                   OR (p.nombre || ' ' || p.apellido_paterno || ' ' || COALESCE(p.apellido_materno,'')) LIKE ?
                   ORDER BY c.fecha_consulta DESC LIMIT ? OFFSET ?""",
                (q, q, q, q, limit, offset),
            ).fetchall()
        else:
            count = conn.execute("SELECT COUNT(*) FROM consultas").fetchone()[0]
            rows = conn.execute(
                "SELECT * FROM consultas ORDER BY fecha_consulta DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        results = [_enrich_consulta(conn, dict(r)) for r in rows]
        return {"data": results, "total": count, "page": page, "limit": limit}


@router.get("/paciente/{paciente_id}")
def list_consultas_by_paciente(paciente_id: int, user=Depends(require_permission("consultas", "lectura"))):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM consultas WHERE paciente_id=? ORDER BY fecha_consulta DESC",
            (paciente_id,),
        ).fetchall()
        return [_enrich_consulta(conn, dict(r)) for r in rows]


@router.get("/{consulta_id}")
def get_consulta(consulta_id: int, user=Depends(require_permission("consultas", "lectura"))):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM consultas WHERE id=?", (consulta_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Consulta no encontrada")
        return _enrich_consulta(conn, dict(row))


@router.post("")
def create_consulta(data: ConsultaCreate, user=Depends(require_permission("consultas", "escritura"))):
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO consultas (paciente_id, fecha_consulta, padecimiento_actual,
               impresion_diagnostica, plan_tratamiento, notas_adicionales, notas_receta, creado_por)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.paciente_id, data.fecha_consulta, data.padecimiento_actual,
             data.impresion_diagnostica, data.plan_tratamiento, data.notas_adicionales,
             data.notas_receta, user["id"]),
        )
        consulta_id = cursor.lastrowid

        conn.execute(
            """INSERT INTO consultas_mediciones
               (consulta_id, peso_kg, talla_cm, fc_bpm, fr_rpm, temperatura_c,
                ta_sistolica, ta_diastolica, cabeza, cuello, torax, abdomen,
                miembros_toracicos, miembros_pelvicos, otros)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (consulta_id, data.peso_kg, data.talla_cm, data.fc_bpm, data.fr_rpm,
             data.temperatura_c, data.ta_sistolica, data.ta_diastolica,
             data.cabeza, data.cuello, data.torax, data.abdomen,
             data.miembros_toracicos, data.miembros_pelvicos, data.otros),
        )
        return {"id": consulta_id, "message": "Consulta creada"}


@router.put("/{consulta_id}")
def update_consulta(consulta_id: int, data: ConsultaCreate, user=Depends(require_permission("consultas", "actualizacion"))):
    with get_db() as conn:
        result = conn.execute(
            """UPDATE consultas SET paciente_id=?, fecha_consulta=?, padecimiento_actual=?,
               impresion_diagnostica=?, plan_tratamiento=?, notas_adicionales=?, notas_receta=?
               WHERE id=?""",
            (data.paciente_id, data.fecha_consulta, data.padecimiento_actual,
             data.impresion_diagnostica, data.plan_tratamiento, data.notas_adicionales,
             data.notas_receta, consulta_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Consulta no encontrada")

        conn.execute("DELETE FROM consultas_mediciones WHERE consulta_id=?", (consulta_id,))
        conn.execute(
            """INSERT INTO consultas_mediciones
               (consulta_id, peso_kg, talla_cm, fc_bpm, fr_rpm, temperatura_c,
                ta_sistolica, ta_diastolica, cabeza, cuello, torax, abdomen,
                miembros_toracicos, miembros_pelvicos, otros)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (consulta_id, data.peso_kg, data.talla_cm, data.fc_bpm, data.fr_rpm,
             data.temperatura_c, data.ta_sistolica, data.ta_diastolica,
             data.cabeza, data.cuello, data.torax, data.abdomen,
             data.miembros_toracicos, data.miembros_pelvicos, data.otros),
        )
        return {"message": "Consulta actualizada"}


@router.delete("/{consulta_id}")
def delete_consulta(consulta_id: int, user=Depends(require_permission("consultas", "eliminacion"))):
    with get_db() as conn:
        result = conn.execute("DELETE FROM consultas WHERE id=?", (consulta_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Consulta no encontrada")
        return {"message": "Consulta eliminada"}
