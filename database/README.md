# Base de Datos - Historia Clinica Pediatrica

Base de datos SQLite con **13 tablas**, modo WAL activado y foreign keys habilitadas.

## Configuracion

```python
# database.py
DB_PATH = os.environ.get("DB_PATH", "database/historial_pediatrico.db")
PRAGMA foreign_keys = ON
PRAGMA journal_mode = WAL
```

## Esquema Completo

### 1. usuarios
Usuarios del sistema con autenticacion JWT.

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| nombre | TEXT | NOT NULL | |
| correo | TEXT | UNIQUE | |
| rol | TEXT | CHECK(IN 'medico','asistente','admin') NOT NULL | 'asistente' |
| password_hash | TEXT | NOT NULL | |
| activo | INTEGER | NOT NULL | 1 |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

Password hasheado con SHA256. Roles: `admin`, `medico`, `asistente`.

---

### 2. permisos
Catalogo de modulos del sistema (7 registros fijos).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| modulo | TEXT | NOT NULL | |
| descripcion | TEXT | NULL | |

**Datos semilla:**

| id | modulo | descripcion |
|----|--------|-------------|
| 1 | pacientes | Gestion de pacientes |
| 2 | consultas | Consultas medicas |
| 3 | antecedentes_pp | Antecedentes personales patologicos |
| 4 | antecedentes_pnp | Antecedentes personales no patologicos |
| 5 | antecedentes_hf | Antecedentes heredo familiares |
| 6 | usuarios | Administracion de usuarios |
| 7 | reportes | Reportes e impresion |

---

### 3. usuario_permisos
Relacion muchos-a-muchos entre usuarios y permisos (4 flags por modulo).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| usuario_id | INTEGER | NOT NULL, FK → usuarios(id) CASCADE | |
| permiso_id | INTEGER | NOT NULL, FK → permisos(id) CASCADE | |
| lectura | INTEGER | NOT NULL | 1 |
| escritura | INTEGER | NOT NULL | 0 |
| actualizacion | INTEGER | NOT NULL | 0 |
| eliminacion | INTEGER | NOT NULL | 0 |

**Constraint:** UNIQUE(usuario_id, permiso_id)
**Index:** `idx_usuario_permisos_usuario` ON (usuario_id)

---

### 4. pacientes
Ficha de identificacion de cada paciente.

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| nombre | TEXT | NOT NULL | |
| apellido_paterno | TEXT | NOT NULL | |
| apellido_materno | TEXT | NULL | |
| fecha_nacimiento | DATE | NOT NULL | |
| sexo | TEXT | CHECK(IN 'F','M','X') NOT NULL | |
| direccion | TEXT | NULL | |
| telefono_contacto | TEXT | NULL | |
| responsable | TEXT | NULL | |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

**Trigger:** `trg_pacientes_updated_at` — actualiza `updated_at` en cada UPDATE.

---

### 5. consultas
Visitas medicas vinculadas a un paciente.

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| paciente_id | INTEGER | NOT NULL, FK → pacientes(id) CASCADE | |
| fecha_consulta | DATE | NOT NULL | |
| padecimiento_actual | TEXT | NOT NULL | |
| impresion_diagnostica | TEXT | NULL | |
| plan_tratamiento | TEXT | NULL | |
| notas_adicionales | TEXT | NULL | |
| creado_por | INTEGER | FK → usuarios(id) | |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

**Index:** `idx_consultas_paciente_fecha` ON (paciente_id, fecha_consulta DESC)
**Trigger:** `trg_consultas_updated_at` — actualiza `updated_at` en cada UPDATE.

---

### 6. consultas_mediciones
Exploracion fisica y signos vitales (1:1 con consultas).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| consulta_id | INTEGER | PRIMARY KEY, FK → consultas(id) CASCADE | |
| peso_kg | REAL | NULL | |
| talla_cm | REAL | NULL | |
| fc_bpm | INTEGER | NULL | Frecuencia cardiaca |
| fr_rpm | INTEGER | NULL | Frecuencia respiratoria |
| temperatura_c | REAL | NULL | |
| ta_sistolica | INTEGER | NULL | |
| ta_diastolica | INTEGER | NULL | |
| cabeza | TEXT | NULL | Exploracion cabeza |
| cuello | TEXT | NULL | Exploracion cuello |
| torax | TEXT | NULL | Exploracion torax |
| abdomen | TEXT | NULL | Exploracion abdomen |
| miembros_toracicos | TEXT | NULL | Extremidades superiores |
| miembros_pelvicos | TEXT | NULL | Extremidades inferiores |
| otros | TEXT | NULL | |

---

### 7. antecedentes_personales_patologicos
Un registro por paciente (1:1).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| paciente_id | INTEGER | NOT NULL, UNIQUE, FK → pacientes(id) CASCADE | |
| enfermedades_exantematicas | TEXT | NULL | |
| alergias | TEXT | NULL | |
| cirugias | TEXT | NULL | |
| otros | TEXT | NULL | |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

**Trigger:** `trg_app_patologicos_updated_at`

---

### 8. antecedentes_personales_no_patologicos
Datos perinatales y de desarrollo. Un registro por paciente (1:1).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| paciente_id | INTEGER | NOT NULL, UNIQUE, FK → pacientes(id) CASCADE | |
| producto_gesta | TEXT | NULL | |
| tipo_nacimiento | TEXT | CHECK(IN 'Eutocico','Cesarea','Instrumental','Otro') NULL | |
| peso_nacer_kg | REAL | NULL | |
| talla_nacer_cm | REAL | NULL | |
| seno_materno | INTEGER | | 0 |
| inicio_formula_meses | INTEGER | NULL | |
| tipo_sangre | TEXT | NULL | |
| apgar | TEXT | NULL | |
| ablactacion | TEXT | NULL | |
| alimentacion | TEXT | NULL | |
| zoonosis | TEXT | NULL | |
| lugar_nacimiento | TEXT | NULL | |
| lugar_residencia | TEXT | NULL | |
| respiro_al_nacer | INTEGER | NULL | |
| lloro_al_nacer | INTEGER | NULL | |
| desarrollo_psicomotor | TEXT | NULL | |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

**Trigger:** `trg_app_no_patologicos_updated_at`

---

### 9. inmunizaciones
Vacunas aplicadas. Relacion N:1 con antecedentes_personales_no_patologicos.

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| antecedentes_np_id | INTEGER | NOT NULL, FK → antecedentes_personales_no_patologicos(id) CASCADE | |
| vacuna | TEXT | NOT NULL | |
| dosis | TEXT | NULL | |
| fecha_aplicacion | DATE | NULL | |
| lote | TEXT | NULL | |
| observaciones | TEXT | NULL | |

**Index:** `idx_inmunizaciones_vacuna_fecha` ON (vacuna, fecha_aplicacion)

---

### 10. antecedentes_heredo_familiares
Patologias familiares. Un registro por paciente (1:1).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| paciente_id | INTEGER | NOT NULL, UNIQUE, FK → pacientes(id) CASCADE | |
| abuelo_paterno | TEXT | NULL | |
| abuela_paterna | TEXT | NULL | |
| abuelo_materno | TEXT | NULL | |
| abuela_materna | TEXT | NULL | |
| padre | TEXT | NULL | |
| madre | TEXT | NULL | |
| hermanos | TEXT | NULL | |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

**Trigger:** `trg_ahf_updated_at`

---

### 11. tratamientos
Medicamentos prescritos por consulta (N:1 con consultas).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| consulta_id | INTEGER | NOT NULL, FK → consultas(id) CASCADE | |
| nombre_medicamento | TEXT | NOT NULL | |
| presentacion | TEXT | NULL | |
| dosificacion | TEXT | NULL | |
| duracion | TEXT | NULL | |
| via_administracion | TEXT | NULL | |
| cantidad_surtir | TEXT | NULL | |

**Index:** `idx_tratamientos_consulta` ON (consulta_id)

---

### 12. documentos_consulta
Archivos adjuntos a consultas (no implementado en UI aun).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| consulta_id | INTEGER | NOT NULL, FK → consultas(id) CASCADE | |
| tipo | TEXT | CHECK(IN 'PDF','Imagen','Otro') NOT NULL | |
| ruta_archivo | TEXT | NOT NULL | |
| hash_archivo | TEXT | NULL | |
| creado_por | INTEGER | FK → usuarios(id) | |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

---

### 13. auditorias
Log de auditoria (no implementado en backend aun).

| Columna | Tipo | Restriccion | Default |
|---------|------|-------------|---------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| entidad | TEXT | NOT NULL | |
| entidad_id | INTEGER | NOT NULL | |
| accion | TEXT | CHECK(IN 'INSERT','UPDATE','DELETE') NOT NULL | |
| usuario_id | INTEGER | FK → usuarios(id) | |
| payload | TEXT | NULL | JSON con datos del cambio |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP |

**Index:** `idx_auditorias_entidad` ON (entidad, entidad_id)

---

## Diagrama de Relaciones

```
usuarios ─────────────┐
    │                  │
    ├─ usuario_permisos ──── permisos (catalogo 7 modulos)
    │
    └─ consultas.creado_por
           │
pacientes ─┤
    │      ├─ consultas ──────┬── consultas_mediciones (1:1)
    │      │                  ├── tratamientos (N:1)
    │      │                  └── documentos_consulta (N:1)
    │      │
    ├── antecedentes_personales_patologicos (1:1)
    ├── antecedentes_personales_no_patologicos (1:1)
    │       └── inmunizaciones (N:1)
    └── antecedentes_heredo_familiares (1:1)

auditorias (independiente, log general)
```

## Indices

| Nombre | Tabla | Columnas |
|--------|-------|----------|
| idx_consultas_paciente_fecha | consultas | (paciente_id, fecha_consulta DESC) |
| idx_inmunizaciones_vacuna_fecha | inmunizaciones | (vacuna, fecha_aplicacion) |
| idx_tratamientos_consulta | tratamientos | (consulta_id) |
| idx_usuario_permisos_usuario | usuario_permisos | (usuario_id) |
| idx_auditorias_entidad | auditorias | (entidad, entidad_id) |

## Triggers

| Nombre | Tabla | Accion |
|--------|-------|--------|
| trg_pacientes_updated_at | pacientes | Auto-update updated_at on UPDATE |
| trg_consultas_updated_at | consultas | Auto-update updated_at on UPDATE |
| trg_app_patologicos_updated_at | antecedentes_personales_patologicos | Auto-update updated_at on UPDATE |
| trg_app_no_patologicos_updated_at | antecedentes_personales_no_patologicos | Auto-update updated_at on UPDATE |
| trg_ahf_updated_at | antecedentes_heredo_familiares | Auto-update updated_at on UPDATE |

## Archivos de referencia

- **Esquema completo:** `scripts/migrate_structure.py`
- **Migracion Access → SQLite:** `scripts/migrate_data.py`
- **Conexion DB:** `backend/src/database.py`
