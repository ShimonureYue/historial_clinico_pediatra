"""Dashboard statistics endpoint."""

from fastapi import APIRouter, Depends
from ..database import get_db
from ..auth import get_current_user

router = APIRouter()


@router.get("/stats")
def get_dashboard_stats(_user=Depends(get_current_user)):
    with get_db() as conn:
        # Total counts
        total_pacientes = conn.execute("SELECT COUNT(*) FROM pacientes").fetchone()[0]
        total_consultas = conn.execute("SELECT COUNT(*) FROM consultas").fetchone()[0]
        total_tratamientos = conn.execute("SELECT COUNT(*) FROM tratamientos").fetchone()[0]

        # This month
        consultas_mes = conn.execute(
            "SELECT COUNT(*) FROM consultas WHERE strftime('%Y-%m', fecha_consulta) = strftime('%Y-%m', 'now')"
        ).fetchone()[0]

        pacientes_mes = conn.execute(
            "SELECT COUNT(*) FROM pacientes WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
        ).fetchone()[0]

        # Last consultation with patient info
        ultima_consulta = conn.execute("""
            SELECT c.id, c.fecha_consulta, c.padecimiento_actual, c.impresion_diagnostica,
                   p.id as paciente_id, p.nombre, p.apellido_paterno, p.apellido_materno
            FROM consultas c
            JOIN pacientes p ON c.paciente_id = p.id
            ORDER BY c.fecha_consulta DESC, c.id DESC
            LIMIT 1
        """).fetchone()

        # Last patient registered
        ultimo_paciente = conn.execute("""
            SELECT id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, created_at
            FROM pacientes
            ORDER BY id DESC
            LIMIT 1
        """).fetchone()

        # Consultas per month (last 6 months)
        consultas_por_mes = conn.execute("""
            SELECT strftime('%Y-%m', fecha_consulta) as mes, COUNT(*) as total
            FROM consultas
            WHERE fecha_consulta >= date('now', '-6 months')
            GROUP BY mes
            ORDER BY mes ASC
        """).fetchall()

        # Pacientes por sexo
        por_sexo = conn.execute("""
            SELECT sexo, COUNT(*) as total FROM pacientes GROUP BY sexo
        """).fetchall()

        # Top 5 diagnosticos mas frecuentes
        top_diagnosticos = conn.execute("""
            SELECT impresion_diagnostica, COUNT(*) as total
            FROM consultas
            WHERE impresion_diagnostica IS NOT NULL AND impresion_diagnostica != ''
            GROUP BY impresion_diagnostica
            ORDER BY total DESC
            LIMIT 5
        """).fetchall()

        # Pacientes nuevos por mes (last 6 months)
        pacientes_por_mes = conn.execute("""
            SELECT strftime('%Y-%m', created_at) as mes, COUNT(*) as total
            FROM pacientes
            WHERE created_at >= date('now', '-6 months')
            GROUP BY mes
            ORDER BY mes ASC
        """).fetchall()

        # Ultimas 5 consultas
        ultimas_consultas = conn.execute("""
            SELECT c.id, c.fecha_consulta, c.padecimiento_actual, c.impresion_diagnostica,
                   p.id as paciente_id, p.nombre, p.apellido_paterno, p.apellido_materno
            FROM consultas c
            JOIN pacientes p ON c.paciente_id = p.id
            ORDER BY c.fecha_consulta DESC, c.id DESC
            LIMIT 5
        """).fetchall()

        # Ultimos 5 pacientes
        ultimos_pacientes = conn.execute("""
            SELECT id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, created_at
            FROM pacientes
            ORDER BY id DESC
            LIMIT 5
        """).fetchall()

        # Promedio consultas por paciente
        avg_consultas = conn.execute("""
            SELECT ROUND(AVG(cnt), 1) FROM (
                SELECT COUNT(*) as cnt FROM consultas GROUP BY paciente_id
            )
        """).fetchone()[0] or 0

        return {
            "total_pacientes": total_pacientes,
            "total_consultas": total_consultas,
            "total_tratamientos": total_tratamientos,
            "consultas_mes": consultas_mes,
            "pacientes_mes": pacientes_mes,
            "avg_consultas_por_paciente": avg_consultas,
            "ultima_consulta": dict(ultima_consulta) if ultima_consulta else None,
            "ultimo_paciente": dict(ultimo_paciente) if ultimo_paciente else None,
            "consultas_por_mes": [dict(r) for r in consultas_por_mes],
            "pacientes_por_mes": [dict(r) for r in pacientes_por_mes],
            "por_sexo": [dict(r) for r in por_sexo],
            "top_diagnosticos": [dict(r) for r in top_diagnosticos],
            "ultimas_consultas": [dict(r) for r in ultimas_consultas],
            "ultimos_pacientes": [dict(r) for r in ultimos_pacientes],
        }
