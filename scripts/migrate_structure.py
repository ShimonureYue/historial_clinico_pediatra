"""
migrate_structure.py
====================
Creates the SQLite database schema for the pediatric clinical history system.
Run this BEFORE migrate_data.py.

Usage:
    python scripts/migrate_structure.py [--db path/to/database.db]

Default database path: database/historial_pediatrico.db
"""

import argparse
import os
import sqlite3
import sys

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "database",
    "historial_pediatrico.db",
)

SCHEMA_SQL = """
-- ============================================================
-- 1. USUARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT    NOT NULL,
    correo          TEXT    UNIQUE,
    rol             TEXT    CHECK(rol IN ('medico','asistente','admin')) NOT NULL DEFAULT 'asistente',
    password_hash   TEXT    NOT NULL,
    activo          INTEGER NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. PERMISOS Y ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS permisos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    modulo          TEXT    NOT NULL,
    descripcion     TEXT    NULL
);

CREATE TABLE IF NOT EXISTS usuario_permisos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    permiso_id      INTEGER NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    lectura         INTEGER NOT NULL DEFAULT 1,
    escritura       INTEGER NOT NULL DEFAULT 0,
    actualizacion   INTEGER NOT NULL DEFAULT 0,
    eliminacion     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(usuario_id, permiso_id)
);

-- ============================================================
-- 3. PACIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS pacientes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre              TEXT    NOT NULL,
    apellido_paterno    TEXT    NOT NULL,
    apellido_materno    TEXT    NULL,
    fecha_nacimiento    DATE   NOT NULL,
    sexo                TEXT    CHECK(sexo IN ('F','M','X')) NOT NULL,
    direccion           TEXT    NULL,
    telefono_contacto   TEXT    NULL,
    responsable         TEXT    NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. CONSULTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS consultas (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id             INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    fecha_consulta          DATE    NOT NULL,
    padecimiento_actual     TEXT    NOT NULL,
    impresion_diagnostica   TEXT    NULL,
    plan_tratamiento        TEXT    NULL,
    notas_adicionales       TEXT    NULL,
    creado_por              INTEGER REFERENCES usuarios(id),
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. CONSULTAS_MEDICIONES (exploración física)
-- ============================================================
CREATE TABLE IF NOT EXISTS consultas_mediciones (
    consulta_id         INTEGER PRIMARY KEY REFERENCES consultas(id) ON DELETE CASCADE,
    peso_kg             REAL    NULL,
    talla_cm            REAL    NULL,
    fc_bpm              INTEGER NULL,
    fr_rpm              INTEGER NULL,
    temperatura_c       REAL    NULL,
    ta_sistolica        INTEGER NULL,
    ta_diastolica       INTEGER NULL,
    cabeza              TEXT    NULL,
    cuello              TEXT    NULL,
    torax               TEXT    NULL,
    abdomen             TEXT    NULL,
    miembros_toracicos  TEXT    NULL,
    miembros_pelvicos   TEXT    NULL,
    otros               TEXT    NULL
);

-- ============================================================
-- 6. ANTECEDENTES PERSONALES PATOLÓGICOS
-- ============================================================
CREATE TABLE IF NOT EXISTS antecedentes_personales_patologicos (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id                 INTEGER NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    enfermedades_exantematicas  TEXT    NULL,
    alergias                    TEXT    NULL,
    cirugias                    TEXT    NULL,
    otros                       TEXT    NULL,
    updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. ANTECEDENTES PERSONALES NO PATOLÓGICOS
-- ============================================================
CREATE TABLE IF NOT EXISTS antecedentes_personales_no_patologicos (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id             INTEGER NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    producto_gesta          TEXT    NULL,
    tipo_nacimiento         TEXT    CHECK(tipo_nacimiento IN ('Eutócico','Cesárea','Instrumental','Otro')) NULL,
    peso_nacer_kg           REAL    NULL,
    talla_nacer_cm          REAL    NULL,
    seno_materno            INTEGER DEFAULT 0,
    inicio_formula_meses    INTEGER NULL,
    tipo_sangre             TEXT    NULL,
    apgar                   TEXT    NULL,
    ablactacion             TEXT    NULL,
    alimentacion            TEXT    NULL,
    zoonosis                TEXT    NULL,
    lugar_nacimiento        TEXT    NULL,
    lugar_residencia        TEXT    NULL,
    respiro_al_nacer        INTEGER DEFAULT NULL,
    lloro_al_nacer          INTEGER DEFAULT NULL,
    desarrollo_psicomotor   TEXT    NULL,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. INMUNIZACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS inmunizaciones (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    antecedentes_np_id  INTEGER NOT NULL REFERENCES antecedentes_personales_no_patologicos(id) ON DELETE CASCADE,
    vacuna              TEXT    NOT NULL,
    dosis               TEXT    NULL,
    fecha_aplicacion    DATE    NULL,
    lote                TEXT    NULL,
    observaciones       TEXT    NULL
);

-- ============================================================
-- 9. ANTECEDENTES HEREDO FAMILIARES
-- ============================================================
CREATE TABLE IF NOT EXISTS antecedentes_heredo_familiares (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id     INTEGER NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
    abuelo_paterno  TEXT    NULL,
    abuela_paterna  TEXT    NULL,
    abuelo_materno  TEXT    NULL,
    abuela_materna  TEXT    NULL,
    padre           TEXT    NULL,
    madre           TEXT    NULL,
    hermanos        TEXT    NULL,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. TRATAMIENTOS (medicamentos por consulta)
-- ============================================================
CREATE TABLE IF NOT EXISTS tratamientos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id         INTEGER NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
    nombre_medicamento  TEXT    NOT NULL,
    presentacion        TEXT    NULL,
    dosificacion        TEXT    NULL,
    duracion            TEXT    NULL,
    via_administracion  TEXT    NULL,
    cantidad_surtir     TEXT    NULL
);

CREATE INDEX IF NOT EXISTS idx_tratamientos_consulta
    ON tratamientos(consulta_id);

-- ============================================================
-- 11. DOCUMENTOS CONSULTA
-- ============================================================
CREATE TABLE IF NOT EXISTS documentos_consulta (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id     INTEGER NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
    tipo            TEXT    CHECK(tipo IN ('PDF','Imagen','Otro')) NOT NULL,
    ruta_archivo    TEXT    NOT NULL,
    hash_archivo    TEXT    NULL,
    creado_por      INTEGER REFERENCES usuarios(id),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 12. AUDITORÍAS
-- ============================================================
CREATE TABLE IF NOT EXISTS auditorias (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entidad     TEXT    NOT NULL,
    entidad_id  INTEGER NOT NULL,
    accion      TEXT    CHECK(accion IN ('INSERT','UPDATE','DELETE')) NOT NULL,
    usuario_id  INTEGER REFERENCES usuarios(id),
    payload     TEXT    NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_consultas_paciente_fecha
    ON consultas(paciente_id, fecha_consulta DESC);

CREATE INDEX IF NOT EXISTS idx_inmunizaciones_vacuna_fecha
    ON inmunizaciones(vacuna, fecha_aplicacion);

CREATE INDEX IF NOT EXISTS idx_auditorias_entidad
    ON auditorias(entidad, entidad_id);

CREATE INDEX IF NOT EXISTS idx_usuario_permisos_usuario
    ON usuario_permisos(usuario_id);

-- ============================================================
-- TRIGGERS – auto-update updated_at
-- ============================================================
CREATE TRIGGER IF NOT EXISTS trg_pacientes_updated_at
AFTER UPDATE ON pacientes
BEGIN
    UPDATE pacientes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_consultas_updated_at
AFTER UPDATE ON consultas
BEGIN
    UPDATE consultas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_app_patologicos_updated_at
AFTER UPDATE ON antecedentes_personales_patologicos
BEGIN
    UPDATE antecedentes_personales_patologicos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_app_no_patologicos_updated_at
AFTER UPDATE ON antecedentes_personales_no_patologicos
BEGIN
    UPDATE antecedentes_personales_no_patologicos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_ahf_updated_at
AFTER UPDATE ON antecedentes_heredo_familiares
BEGIN
    UPDATE antecedentes_heredo_familiares SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================================
-- SEED: módulos de permisos por defecto
-- ============================================================
INSERT OR IGNORE INTO permisos (id, modulo, descripcion) VALUES
    (1, 'pacientes',           'Gestión de pacientes'),
    (2, 'consultas',           'Consultas médicas'),
    (3, 'antecedentes_pp',     'Antecedentes personales patológicos'),
    (4, 'antecedentes_pnp',    'Antecedentes personales no patológicos'),
    (5, 'antecedentes_hf',     'Antecedentes heredo familiares'),
    (6, 'usuarios',            'Administración de usuarios'),
    (7, 'reportes',            'Reportes e impresión');
"""


def create_database(db_path: str) -> None:
    """Create the SQLite database and apply the schema."""
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    already_exists = os.path.exists(db_path)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.executescript(SCHEMA_SQL)
    conn.commit()

    # Verify tables were created
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    )
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()

    action = "actualizada" if already_exists else "creada"
    print(f"\nBase de datos {action} en: {db_path}")
    print(f"Tablas creadas ({len(tables)}):")
    for t in tables:
        print(f"  - {t}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Crea la estructura de la base de datos SQLite para Historia Clínica Pediátrica"
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB_PATH,
        help=f"Ruta al archivo de base de datos (default: {DEFAULT_DB_PATH})",
    )
    args = parser.parse_args()

    try:
        create_database(args.db)
        print("Migración de estructura completada exitosamente.")
    except Exception as e:
        print(f"Error durante la migración de estructura: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
