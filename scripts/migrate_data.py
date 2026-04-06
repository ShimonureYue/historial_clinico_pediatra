"""
migrate_data.py
===============
Migrates data from the Microsoft Access (.mdb) database (BD.mdb) into the
SQLite database created by migrate_structure.py.

Requirements:
    brew install mdbtools   # macOS

Usage:
    python scripts/migrate_data.py --access documentation/BD.mdb [--db path/to/sqlite.db]

If no Access database is provided, the script creates sample/seed data instead.
"""

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "database",
    "historial_pediatrico.db",
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def parse_date(value: str) -> str | None:
    """Parse Access date format 'MM/DD/YY HH:MM:SS' or other common formats into YYYY-MM-DD.

    Python's %y pivot is 2000-2068 for 00-68, 1969-1999 for 69-99.
    For a pediatric clinic (data from ~2006-2026), birth dates before 2026 are expected.
    We fix any result > current year by subtracting 100 years.
    """
    if not value or value.strip() == "":
        return None
    v = value.strip()
    for fmt in (
        "%m/%d/%y %H:%M:%S",   # Access default: 08/10/84 00:00:00
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%y",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%d-%m-%Y",
    ):
        try:
            dt = datetime.strptime(v, fmt)
            # Fix 2-digit year pivot: if parsed year is in the future, subtract 100
            if dt.year > datetime.now().year:
                dt = dt.replace(year=dt.year - 100)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def safe_float(value: str) -> float | None:
    if not value or value.strip() == "":
        return None
    try:
        return float(value.strip().replace(",", "."))
    except ValueError:
        return None


def safe_int(value: str) -> int | None:
    if not value or value.strip() == "":
        return None
    try:
        return int(float(value.strip().replace(",", ".")))
    except ValueError:
        return None


def safe_text(value: str) -> str | None:
    if not value or value.strip() == "":
        return None
    return value.strip()


def safe_bool(value: str) -> int | None:
    if not value or value.strip() == "":
        return None
    v = value.strip().lower()
    if v in ("1", "true", "si", "sí", "yes", "-1"):
        return 1
    return 0


def normalize_tipo_nacimiento(value: str) -> str | None:
    """Normalize the very messy Tipo_Nacimiento field from Access into valid CHECK values."""
    if not value or value.strip() == "":
        return None
    v = value.strip().upper()
    # Match cesárea variants (many typos in the data)
    if re.match(r"^C.*(?:ESAR|ESRA|ESARE|EREA|SARE|ESAR)", v) or v in (
        "CESAREA", "CESREA", "CESRAEA", "CESARE", "CEESAREA", "CEAREA",
        "CESAERA", "CESARAEA", "CESARERA", "CESSAREA", "CESARES",
        "CESAREAS", "ICESAREA", "CECESAREA", "CESRAREA", "CESARREA",
        "CESARWEA", "CERSAREA", "CERAREA", "CSAREA ( GEMELAR)",
    ):
        return "Cesárea"
    if v.startswith("CES") or v.startswith("C ES"):
        return "Cesárea"
    # Match parto variants
    if v.startswith("PART") or v.startswith("PPARTO") or v in (
        "PARTO", "PARTRO", "PARTPO", "PRTO", "PASTO", "PASRTO",
        "PAEERTO", "OPARTO", "PARTOI", "PARTOE", "PARTIO",
    ):
        return "Eutócico"
    if v == "PARTO NORMAL":
        return "Eutócico"
    # Everything else → Otro
    return "Otro"


def split_ta(ta_value: str) -> tuple[int | None, int | None]:
    """Split a TA field like '120/80' into (sistolica, diastolica).
    Access stores TA as a single field; if it's just a number like '0', return (None, None)."""
    if not ta_value or ta_value.strip() == "" or ta_value.strip() == "0":
        return None, None
    v = ta_value.strip()
    if "/" in v:
        parts = v.split("/")
        return safe_int(parts[0]), safe_int(parts[1])
    # Single number — could be systolic only
    val = safe_int(v)
    if val and val > 20:
        return val, None
    return None, None


def split_nombre(full_name: str) -> tuple[str, str, str | None]:
    """Split Access 'Nombre' field into (nombre, apellido_paterno, apellido_materno).
    Access stores names as 'ApellidoPaterno ApellidoMaterno Nombre(s)'
    e.g. 'Vargas Marquez Rogelio' → ('Rogelio', 'Vargas', 'Marquez')
    """
    if not full_name or full_name.strip() == "":
        return ("", "", None)
    parts = full_name.strip().split()
    if len(parts) == 1:
        return (parts[0], parts[0], None)
    if len(parts) == 2:
        return (parts[1], parts[0], None)
    if len(parts) == 3:
        return (parts[2], parts[0], parts[1])
    # 4+ parts: first two are apellidos, rest is nombre
    apellido_p = parts[0]
    apellido_m = parts[1]
    nombre = " ".join(parts[2:])
    return (nombre, apellido_p, apellido_m)


def map_sexo(value: str) -> str:
    """Map Access 'Masculino'/'Femenino' to 'M'/'F'."""
    if not value:
        return "X"
    v = value.strip().upper()
    if v.startswith("M"):
        return "M"
    if v.startswith("F"):
        return "F"
    return "X"


# ── mdbtools helpers ─────────────────────────────────────────────────────────

def mdb_tables(access_path: str) -> list[str]:
    """List table names using mdb-tables."""
    result = subprocess.run(
        ["mdb-tables", "-1", access_path],
        capture_output=True, text=True, check=True,
    )
    return [t.strip() for t in result.stdout.strip().split("\n") if t.strip()]


def mdb_export_csv(access_path: str, table_name: str) -> list[dict]:
    """Export a table to a list of dicts using mdb-export."""
    result = subprocess.run(
        ["mdb-export", access_path, table_name],
        capture_output=True, text=True, check=True,
    )
    reader = csv.DictReader(io.StringIO(result.stdout))
    return list(reader)


# ── Migration functions ──────────────────────────────────────────────────────

def migrate_from_access(access_path: str, db_path: str) -> None:
    """Migrate data from Access to SQLite."""
    print(f"Leyendo base de datos Access: {access_path}")

    try:
        tables = mdb_tables(access_path)
    except FileNotFoundError:
        print(
            "Error: mdb-tables no encontrado. Instala mdbtools:\n"
            "  macOS:  brew install mdbtools\n"
            "  Linux:  sudo apt install mdbtools\n",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Tablas encontradas en Access ({len(tables)}): {', '.join(tables)}")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=OFF;")  # OFF during bulk import for speed
    cursor = conn.cursor()

    # Order matters: pacientes first, then tables that reference them
    migration_steps = [
        ("Paciente", migrate_pacientes),
        ("Consulta_Completa", migrate_consultas),
        ("Ante_Per_Patologicos", migrate_antecedentes_patologicos),
        ("Ante_Perso_NoPatologicos", migrate_antecedentes_no_patologicos),
        ("Ante_Heredo_Familiares", migrate_antecedentes_heredo_familiares),
        ("Inmunizaciones_X_Paciente", migrate_inmunizaciones),
        ("Desarrollo_Psicomotor", migrate_desarrollo_psicomotor),
    ]

    migrated_count = {}
    skipped_count = {}
    for access_table, handler in migration_steps:
        if access_table not in tables:
            print(f"  {access_table}: tabla no encontrada en Access (se omite)")
            continue
        rows = mdb_export_csv(access_path, access_table)
        count, skipped = handler(cursor, rows)
        migrated_count[access_table] = count
        skipped_count[access_table] = skipped
        print(f"  {access_table}: {count} registros migrados, {skipped} omitidos")

    # Tables we intentionally skip
    for t in tables:
        if t not in [s[0] for s in migration_steps]:
            print(f"  {t}: tabla no mapeada (se omite)")

    # Create default users (Access has no users table)
    create_default_users(cursor)

    conn.execute("PRAGMA foreign_keys=ON;")
    conn.commit()
    conn.close()

    print(f"\nMigración de datos completada.")
    print(f"Resumen migrados: {json.dumps(migrated_count, indent=2)}")
    print(f"Resumen omitidos: {json.dumps(skipped_count, indent=2)}")


def create_default_users(cursor) -> None:
    """Create only the admin user (Access has no users table). Doctor/staff created manually."""
    pw_admin = hashlib.sha256("admin123".encode()).hexdigest()
    cursor.execute(
        """INSERT OR IGNORE INTO usuarios (nombre, correo, rol, password_hash, activo)
           VALUES (?, ?, ?, ?, ?)""",
        ("Administrador", "admin@clinica.com", "admin", pw_admin, 1),
    )
    admin_id = cursor.lastrowid or 1

    cursor.execute("SELECT id FROM permisos")
    for (pid,) in cursor.fetchall():
        cursor.execute(
            """INSERT OR IGNORE INTO usuario_permisos
               (usuario_id, permiso_id, lectura, escritura, actualizacion, eliminacion)
               VALUES (?, ?, 1, 1, 1, 1)""",
            (admin_id, pid),
        )

    print(f"  Usuario admin creado: admin@clinica.com / admin123 (id={admin_id})")


def migrate_pacientes(cursor, rows: list[dict]) -> tuple[int, int]:
    """Migrate patient records from Access 'Paciente' table.

    Access columns: Id_Paciente, Nombre, Fecha_Nacimiento, Direccion, Sexo, Fecha_Ingreso
    Nombre contains full name as 'ApellidoP ApellidoM Nombre(s)'.
    Sexo is 'Masculino'/'Femenino'.
    No telefono or responsable fields in Access.
    """
    count = 0
    skipped = 0
    for row in rows:
        pac_id = safe_int(row.get("Id_Paciente", ""))
        full_name = safe_text(row.get("Nombre", ""))
        fecha_nac = parse_date(row.get("Fecha_Nacimiento", ""))
        fecha_ingreso = parse_date(row.get("Fecha_Ingreso", ""))

        if not full_name or not fecha_nac:
            skipped += 1
            continue

        nombre, apellido_p, apellido_m = split_nombre(full_name)
        sexo = map_sexo(row.get("Sexo", ""))
        direccion = safe_text(row.get("Direccion", ""))

        # Use INSERT with explicit id to preserve Access IDs for FK references
        cursor.execute(
            """INSERT INTO pacientes (id, nombre, apellido_paterno, apellido_materno,
               fecha_nacimiento, sexo, direccion, telefono_contacto, responsable, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                pac_id,
                nombre,
                apellido_p,
                apellido_m,
                fecha_nac,
                sexo,
                direccion,
                None,  # no telefono in Access
                None,  # no responsable in Access
                fecha_ingreso or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )
        count += 1
    return count, skipped


def migrate_consultas(cursor, rows: list[dict]) -> tuple[int, int]:
    """Migrate consultation records from Access 'Consulta_Completa' table.

    Access columns: Id_Consulta, Id_Paciente, Fecha_Consulta, Padecimiento,
    Impresion_Diagnostica, Tratamiento, Peso, Talla, FC, FR, Temperatura, TA,
    Cabeza, Cuello, Torax, Abdomen, Miembros_Toracicos, Miembros_Pelvicos, Otros

    TA is a single field (e.g. '120/80' or '0') — needs splitting.
    Tratamiento maps to plan_tratamiento.
    """
    count = 0
    skipped = 0
    for row in rows:
        pac_id = safe_int(row.get("Id_Paciente", ""))
        if not pac_id:
            skipped += 1
            continue

        fecha = parse_date(row.get("Fecha_Consulta", ""))
        padecimiento = safe_text(row.get("Padecimiento", ""))

        if not fecha or not padecimiento:
            skipped += 1
            continue

        ta_sys, ta_dia = split_ta(row.get("TA", ""))

        cursor.execute(
            """INSERT INTO consultas (paciente_id, fecha_consulta, padecimiento_actual,
               impresion_diagnostica, plan_tratamiento, notas_adicionales)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                pac_id, fecha, padecimiento,
                safe_text(row.get("Impresion_Diagnostica", "")),
                safe_text(row.get("Tratamiento", "")),
                None,  # no notas_adicionales in Access
            ),
        )
        consulta_id = cursor.lastrowid

        # Migrate physical exam measurements
        peso = safe_float(row.get("Peso", ""))
        talla = safe_float(row.get("Talla", ""))
        fc = safe_int(row.get("FC", ""))
        fr = safe_int(row.get("FR", ""))
        temp = safe_float(row.get("Temperatura", ""))
        cabeza = safe_text(row.get("Cabeza", ""))
        cuello = safe_text(row.get("Cuello", ""))
        torax = safe_text(row.get("Torax", ""))
        abdomen = safe_text(row.get("Abdomen", ""))
        mt = safe_text(row.get("Miembros_Toracicos", ""))
        mp = safe_text(row.get("Miembros_Pelvicos", ""))
        otros = safe_text(row.get("Otros", ""))

        has_any = any([peso, talla, fc, fr, temp, ta_sys, ta_dia,
                       cabeza, cuello, torax, abdomen, mt, mp, otros])
        if has_any:
            cursor.execute(
                """INSERT INTO consultas_mediciones
                   (consulta_id, peso_kg, talla_cm, fc_bpm, fr_rpm, temperatura_c,
                    ta_sistolica, ta_diastolica, cabeza, cuello, torax, abdomen,
                    miembros_toracicos, miembros_pelvicos, otros)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    consulta_id, peso, talla,
                    fc if fc and fc > 0 else None,
                    fr if fr and fr > 0 else None,
                    temp,
                    ta_sys, ta_dia,
                    cabeza, cuello, torax, abdomen, mt, mp, otros,
                ),
            )
        count += 1
    return count, skipped


def migrate_antecedentes_patologicos(cursor, rows: list[dict]) -> tuple[int, int]:
    """Migrate pathological personal history from Access 'Ante_Per_Patologicos'.

    Access columns: Id_Ante_Patologicos, Enfermedades_Exatematicas (typo), Alergias, Cirugias, Otros
    Id_Ante_Patologicos IS the paciente_id (same value).
    """
    count = 0
    skipped = 0
    for row in rows:
        pac_id = safe_int(row.get("Id_Ante_Patologicos", ""))
        if not pac_id:
            skipped += 1
            continue

        cursor.execute(
            """INSERT OR REPLACE INTO antecedentes_personales_patologicos
               (paciente_id, enfermedades_exantematicas, alergias, cirugias, otros)
               VALUES (?, ?, ?, ?, ?)""",
            (
                pac_id,
                safe_text(row.get("Enfermedades_Exatematicas", "")),  # typo in Access
                safe_text(row.get("Alergias", "")),
                safe_text(row.get("Cirugias", "")),
                safe_text(row.get("Otros", "")),
            ),
        )
        count += 1
    return count, skipped


def migrate_antecedentes_no_patologicos(cursor, rows: list[dict]) -> tuple[int, int]:
    """Migrate non-pathological personal history from Access 'Ante_Perso_NoPatologicos'.

    Access columns: Id_Ante_NoPatologicos, Tipo_Sangre, Lugar_Nacimiento, Lugar_Recidencia (typo),
    Zoonosis, Alimentacion, Producto_Gesta, Respiro_Nacer, Lloro_Nacer, Peso_Nacer, Talla_Nacer,
    Apgar, Seno_Materno, Inicio_Formula, Ablactacion, Tipo_Nacimiento

    Id_Ante_NoPatologicos IS the paciente_id.
    Tipo_Nacimiento is very messy data — normalized to CHECK constraint values.
    """
    count = 0
    skipped = 0
    for row in rows:
        pac_id = safe_int(row.get("Id_Ante_NoPatologicos", ""))
        if not pac_id:
            skipped += 1
            continue

        tipo_nac = normalize_tipo_nacimiento(row.get("Tipo_Nacimiento", ""))

        cursor.execute(
            """INSERT OR REPLACE INTO antecedentes_personales_no_patologicos
               (paciente_id, producto_gesta, tipo_nacimiento, peso_nacer_kg, talla_nacer_cm,
                seno_materno, inicio_formula_meses, tipo_sangre, apgar,
                ablactacion, alimentacion, zoonosis, lugar_nacimiento, lugar_residencia,
                respiro_al_nacer, lloro_al_nacer)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                pac_id,
                safe_text(row.get("Producto_Gesta", "")),
                tipo_nac,
                safe_float(row.get("Peso_Nacer", "")),
                safe_float(row.get("Talla_Nacer", "")),
                safe_bool(row.get("Seno_Materno", "")),
                safe_int(row.get("Inicio_Formula", "")),
                safe_text(row.get("Tipo_Sangre", "")),
                safe_text(row.get("Apgar", "")),
                safe_text(row.get("Ablactacion", "")),
                safe_text(row.get("Alimentacion", "")),
                safe_text(row.get("Zoonosis", "")),
                safe_text(row.get("Lugar_Nacimiento", "")),
                safe_text(row.get("Lugar_Recidencia", "")),  # typo in Access
                safe_bool(row.get("Respiro_Nacer", "")),
                safe_bool(row.get("Lloro_Nacer", "")),
            ),
        )
        count += 1
    return count, skipped


def migrate_antecedentes_heredo_familiares(cursor, rows: list[dict]) -> tuple[int, int]:
    """Migrate family medical history from Access 'Ante_Heredo_Familiares'.

    Access columns: Id_HeredoFamiliares, Abuelo_P, Abuela_P, Abuelo_M, Abuela_M,
    Padre, Madre, Hermanos

    Id_HeredoFamiliares IS the paciente_id.
    Column names are abbreviated (Abuelo_P → abuelo_paterno, etc.).
    """
    count = 0
    skipped = 0
    for row in rows:
        pac_id = safe_int(row.get("Id_HeredoFamiliares", ""))
        if not pac_id:
            skipped += 1
            continue

        cursor.execute(
            """INSERT OR REPLACE INTO antecedentes_heredo_familiares
               (paciente_id, abuelo_paterno, abuela_paterna, abuelo_materno,
                abuela_materna, padre, madre, hermanos)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                pac_id,
                safe_text(row.get("Abuelo_P", "")),
                safe_text(row.get("Abuela_P", "")),
                safe_text(row.get("Abuelo_M", "")),
                safe_text(row.get("Abuela_M", "")),
                safe_text(row.get("Padre", "")),
                safe_text(row.get("Madre", "")),
                safe_text(row.get("Hermanos", "")),
            ),
        )
        count += 1
    return count, skipped


def migrate_inmunizaciones(cursor, rows: list[dict]) -> tuple[int, int]:
    """Migrate immunization records from Access 'Inmunizaciones_X_Paciente'.

    Access columns: Id_Paciente, Id_Inmunizaciones, Aplicada, Nombre

    This is a flat table linking paciente to vaccine name with an Aplicada flag.
    Only migrate rows where Aplicada=1.
    We need the antecedentes_np_id — look it up from paciente_id.
    """
    count = 0
    skipped = 0
    # Cache: paciente_id → antecedentes_np.id
    np_cache = {}

    for row in rows:
        pac_id = safe_int(row.get("Id_Paciente", ""))
        aplicada = safe_int(row.get("Aplicada", ""))
        vacuna = safe_text(row.get("Nombre", ""))

        if not pac_id or not aplicada or not vacuna:
            skipped += 1
            continue

        # Look up antecedentes_np_id for this paciente
        if pac_id not in np_cache:
            cursor.execute(
                "SELECT id FROM antecedentes_personales_no_patologicos WHERE paciente_id = ?",
                (pac_id,),
            )
            result = cursor.fetchone()
            np_cache[pac_id] = result[0] if result else None

        np_id = np_cache[pac_id]
        if np_id is None:
            # Create a minimal antecedentes_np record so we can link immunizations
            cursor.execute(
                """INSERT OR IGNORE INTO antecedentes_personales_no_patologicos
                   (paciente_id) VALUES (?)""",
                (pac_id,),
            )
            cursor.execute(
                "SELECT id FROM antecedentes_personales_no_patologicos WHERE paciente_id = ?",
                (pac_id,),
            )
            result = cursor.fetchone()
            np_id = result[0] if result else None
            np_cache[pac_id] = np_id

        if np_id is None:
            skipped += 1
            continue

        # Extract dosis from vaccine name if present (e.g. "Pentavalente 1a." → dosis="1a.")
        dosis = None
        vacuna_clean = vacuna
        match = re.match(r"^(.+?)\s+(\d+[aA]\.?)$", vacuna)
        if match:
            vacuna_clean = match.group(1)
            dosis = match.group(2)

        cursor.execute(
            """INSERT INTO inmunizaciones (antecedentes_np_id, vacuna, dosis, fecha_aplicacion, lote, observaciones)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (np_id, vacuna_clean, dosis, None, None, None),
        )
        count += 1
    return count, skipped


def migrate_desarrollo_psicomotor(cursor, rows: list[dict]) -> tuple[int, int]:
    """Migrate developmental milestones from Access 'Desarrollo_Psicomotor'.

    Access columns: Id_Desarrollo_Psicomotor, ID_Paciente,
    Sonrisa_Social, Levantamiento_Cabeza, Sento_Solo, Paro_Ayuda,
    Gateo, Camino, Inicio_Lenguaje, Control_Esfinteres,
    Inicio_JardinNinos, Primaria

    Updates antecedentes_personales_no_patologicos by paciente_id.
    """
    count = 0
    skipped = 0
    for row in rows:
        pac_id = safe_int(row.get("ID_Paciente", ""))
        if not pac_id:
            skipped += 1
            continue

        cursor.execute(
            """UPDATE antecedentes_personales_no_patologicos
               SET sonrisa_social=?, levantamiento_cabeza=?, sento_solo=?, paro_ayuda=?,
                   gateo=?, camino=?, inicio_lenguaje=?, control_esfinteres=?,
                   inicio_jardin_ninos=?, primaria=?
               WHERE paciente_id=?""",
            (
                safe_text(row.get("Sonrisa_Social", "")),
                safe_text(row.get("Levantamiento_Cabeza", "")),
                safe_text(row.get("Sento_Solo", "")),
                safe_text(row.get("Paro_Ayuda", "")),
                safe_text(row.get("Gateo", "")),
                safe_text(row.get("Camino", "")),
                safe_text(row.get("Inicio_Lenguaje", "")),
                safe_text(row.get("Control_Esfinteres", "")),
                safe_text(row.get("Inicio_JardinNinos", "")),
                safe_text(row.get("Primaria", "")),
                pac_id,
            ),
        )
        if cursor.rowcount > 0:
            count += 1
        else:
            skipped += 1
    return count, skipped


# ── Seed data for development ────────────────────────────────────────────────

def create_seed_data(db_path: str) -> None:
    """Insert sample data for development/testing when no Access DB is available."""
    print("No se proporcionó base de datos Access. Creando datos de ejemplo...")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys=ON;")
    cursor = conn.cursor()

    # Create admin user (password: admin123)
    password_hash = hashlib.sha256("admin123".encode()).hexdigest()
    cursor.execute(
        """INSERT OR IGNORE INTO usuarios (nombre, correo, rol, password_hash, activo)
           VALUES (?, ?, ?, ?, ?)""",
        ("Administrador", "admin@clinica.com", "admin", password_hash, 1),
    )
    admin_id = cursor.lastrowid or 1

    # Assign all permissions to admin
    cursor.execute("SELECT id FROM permisos")
    for (permiso_id,) in cursor.fetchall():
        cursor.execute(
            """INSERT OR IGNORE INTO usuario_permisos
               (usuario_id, permiso_id, lectura, escritura, actualizacion, eliminacion)
               VALUES (?, ?, 1, 1, 1, 1)""",
            (admin_id, permiso_id),
        )

    # Create a sample doctor user (password: doctor123)
    doc_hash = hashlib.sha256("doctor123".encode()).hexdigest()
    cursor.execute(
        """INSERT OR IGNORE INTO usuarios (nombre, correo, rol, password_hash, activo)
           VALUES (?, ?, ?, ?, ?)""",
        ("Dr. Roberto García", "doctor@clinica.com", "medico", doc_hash, 1),
    )
    doctor_id = cursor.lastrowid or 2

    # Doctor permissions: read/write on clinical modules, no user management
    for permiso_id in [1, 2, 3, 4, 5, 7]:
        cursor.execute(
            """INSERT OR IGNORE INTO usuario_permisos
               (usuario_id, permiso_id, lectura, escritura, actualizacion, eliminacion)
               VALUES (?, ?, 1, 1, 1, 0)""",
            (doctor_id, permiso_id),
        )

    # Sample patients
    pacientes = [
        ("María", "López", "García", "2018-05-12", "F", "Calle Reforma 123, Col. Centro", "5551234567", "Ana García de López"),
        ("Carlos", "Martínez", "Rodríguez", "2020-03-22", "M", "Av. Juárez 456, Col. Norte", "5559876543", "Laura Rodríguez"),
        ("Sofía", "Hernández", "Pérez", "2019-11-08", "F", "Blvd. Independencia 789", "5554567890", "Pedro Hernández"),
        ("Diego", "González", "Torres", "2021-07-15", "M", "Calle Hidalgo 321", "5553216549", "María Torres de González"),
        ("Valentina", "Ramírez", "Sánchez", "2017-01-30", "F", "Av. Morelos 654", "5557891234", "José Ramírez"),
    ]

    for p in pacientes:
        cursor.execute(
            """INSERT INTO pacientes (nombre, apellido_paterno, apellido_materno,
               fecha_nacimiento, sexo, direccion, telefono_contacto, responsable)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            p,
        )

    # Sample consultations for patient 1
    cursor.execute(
        """INSERT INTO consultas (paciente_id, fecha_consulta, padecimiento_actual,
           impresion_diagnostica, plan_tratamiento, creado_por)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (1, "2024-01-15", "Fiebre de 38.5°C por 2 días, tos seca y congestión nasal",
         "Infección de vías respiratorias superiores", "Paracetamol 15mg/kg cada 6hrs, hidratación abundante", doctor_id),
    )
    cursor.execute(
        """INSERT INTO consultas_mediciones
           (consulta_id, peso_kg, talla_cm, fc_bpm, fr_rpm, temperatura_c,
            ta_sistolica, ta_diastolica, cabeza, cuello, torax, abdomen,
            miembros_toracicos, miembros_pelvicos, otros)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (1, 22.5, 110, 100, 24, 38.5, 90, 60,
         "Normocéfala", "Sin adenomegalias", "Murmullo vesicular presente",
         "Blando, depresible, sin dolor", "Sin alteraciones", "Sin alteraciones", None),
    )

    conn.commit()
    conn.close()

    print("Datos de ejemplo creados exitosamente:")
    print("  - 2 usuarios (admin@clinica.com / admin123, doctor@clinica.com / doctor123)")
    print("  - 5 pacientes de ejemplo")
    print("  - 1 consulta con mediciones")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Migra datos desde Access a SQLite, o crea datos de ejemplo"
    )
    parser.add_argument(
        "--access",
        default=None,
        help="Ruta a la base de datos Access (.mdb/.accdb)",
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB_PATH,
        help=f"Ruta a la base de datos SQLite (default: {DEFAULT_DB_PATH})",
    )
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"Error: La base de datos SQLite no existe en {args.db}", file=sys.stderr)
        print("Ejecuta primero: python scripts/migrate_structure.py", file=sys.stderr)
        sys.exit(1)

    if args.access:
        if not os.path.exists(args.access):
            print(f"Error: No se encontró el archivo Access: {args.access}", file=sys.stderr)
            sys.exit(1)
        migrate_from_access(args.access, args.db)
    else:
        create_seed_data(args.db)

    print("\nMigración de datos completada exitosamente.")


if __name__ == "__main__":
    main()
