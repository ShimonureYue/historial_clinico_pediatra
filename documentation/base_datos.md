# Definición de base de datos – Historia Clínica Pediátrica

Este documento describe el modelo relacional propuesto para migrar el sistema médico escrito en Visual Basic a una arquitectura Python (API), React (frontend) y SQLite como motor de almacenamiento local con posibilidad de sincronizarse con otros RDBMS en el futuro. La nomenclatura usa minúsculas con guiones bajos y tipos compatibles con SQLite 3.

## 1. Reglas de negocio clave
- Cada paciente puede registrar múltiples consultas y cada consulta debe conservar la fotografía completa de la exploración física, impresión diagnóstica y tratamiento del día.
- Los antecedentes personales (patológicos y no patológicos) y los antecedentes heredo‑familiares son formularios independientes, pero referencian al mismo paciente; solo debe existir un registro activo por categoría y paciente.
- El historial de inmunizaciones requiere saber qué vacuna se aplicó y cuándo; por ello se modela como tabla propia, ligada al registro de antecedentes no patológicos.
- Se requiere evidencia imprimible; para ello se guarda un folio y una referencia al archivo PDF generado por cada consulta.
- Todas las operaciones deben quedar auditadas con usuario, fecha de creación y última actualización.

## 2. Resumen de entidades
1. **pacientes** – datos demográficos y de identificación.
2. **consultas** – visitas médicas y exploración física.
3. **consultas_mediciones** – vitales registrados en cada consulta para facilitar búsquedas y gráficas.
4. **antecedentes_personales_patologicos** – enfermedades previas, alergias, cirugías.
5. **antecedentes_personales_no_patologicos** – datos perinatales, hábitos, factores ambientales.
6. **inmunizaciones** – catálogo de eventos de vacunación ligados a antecedentes no patológicos.
7. **antecedentes_heredo_familiares** – patologías relevantes en familiares.
8. **documentos_consulta** – referencia a PDFs o imágenes impresas.
9. **usuarios** – personal autorizado.
10. **auditorias** – bitácora de cambios sensibles.

## 3. Definición de tablas

### 3.1 pacientes
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK, AUTOINCREMENT | Identificador interno |
| nombre | TEXT | NOT NULL | Nombre(s) |
| apellido_paterno | TEXT | NOT NULL | Primer apellido |
| apellido_materno | TEXT | NULL | Segundo apellido |
| fecha_nacimiento | DATE | NOT NULL | Formato ISO `YYYY-MM-DD` |
| sexo | TEXT | CHECK (sexo IN ('F','M','X')) | Sexo registrado |
| direccion | TEXT | NULL | Dirección habitual |
| telefono_contacto | TEXT | NULL | Teléfono o celular |
| responsable | TEXT | NULL | Nombre del tutor/responsable |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Fecha de alta |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Última modificación (trigger actualiza) |

### 3.2 consultas
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK, AUTOINCREMENT |
| paciente_id | INTEGER | FK → pacientes.id ON DELETE CASCADE |
| fecha_consulta | DATE | NOT NULL |
| padecimiento_actual | TEXT | NOT NULL |
| impresion_diagnostica | TEXT | NULL |
| plan_tratamiento | TEXT | NULL |
| notas_adicionales | TEXT | NULL |
| creado_por | INTEGER | FK → usuarios.id |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 3.3 consultas_mediciones
Registra los valores numéricos de la exploración física para permitir consultas analíticas.

| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| consulta_id | INTEGER | PK + FK → consultas.id ON DELETE CASCADE |
| peso_kg | REAL | NULL |
| talla_cm | REAL | NULL |
| fc_bpm | INTEGER | NULL | Frecuencia cardiaca |
| fr_rpm | INTEGER | NULL | Frecuencia respiratoria |
| temperatura_c | REAL | NULL |
| ta_sistolica | INTEGER | NULL |
| ta_diastolica | INTEGER | NULL |
| cabeza | TEXT | NULL |
| cuello | TEXT | NULL |
| torax | TEXT | NULL |
| abdomen | TEXT | NULL |
| miembros_toracicos | TEXT | NULL |
| miembros_pelvicos | TEXT | NULL |
| otros | TEXT | NULL |

### 3.4 antecedentes_personales_patologicos
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK |
| paciente_id | INTEGER | UNIQUE, FK → pacientes.id ON DELETE CASCADE |
| enfermedades_exantematicas | TEXT | NULL |
| alergias | TEXT | NULL |
| cirugias | TEXT | NULL |
| otros | TEXT | NULL |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 3.5 antecedentes_personales_no_patologicos
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK |
| paciente_id | INTEGER | UNIQUE, FK → pacientes.id ON DELETE CASCADE |
| producto_gesta | TEXT | NULL |
| tipo_nacimiento | TEXT | CHECK(tipo_nacimiento IN ('Eutócico','Cesárea','Instrumental','Otro')) |
| peso_nacer_kg | REAL | NULL |
| talla_nacer_cm | REAL | NULL |
| seno_materno | BOOLEAN | DEFAULT 0 |
| inicio_formula_meses | INTEGER | NULL |
| tipo_sangre | TEXT | NULL |
| apgar | TEXT | NULL |
| ablactacion | TEXT | NULL |
| alimentacion | TEXT | NULL |
| zoonosis | TEXT | NULL |
| lugar_nacimiento | TEXT | NULL |
| lugar_residencia | TEXT | NULL |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 3.6 inmunizaciones
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK |
| antecedentes_np_id | INTEGER | FK → antecedentes_personales_no_patologicos.id ON DELETE CASCADE |
| vacuna | TEXT | NOT NULL | Ej. 'BCG', 'Pentavalente', 'Sabin', 'Triple Viral', 'Hepatitis', 'Otra' |
| dosis | TEXT | NULL | 1a, 2a, refuerzo |
| fecha_aplicacion | DATE | NULL |
| lote | TEXT | NULL |
| observaciones | TEXT | NULL |

### 3.7 antecedentes_heredo_familiares
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK |
| paciente_id | INTEGER | UNIQUE, FK → pacientes.id ON DELETE CASCADE |
| abuelo_paterno | TEXT | NULL |
| abuela_paterna | TEXT | NULL |
| abuelo_materno | TEXT | NULL |
| abuela_materna | TEXT | NULL |
| padre | TEXT | NULL |
| madre | TEXT | NULL |
| hermanos | TEXT | NULL |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 3.8 documentos_consulta
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK |
| consulta_id | INTEGER | FK → consultas.id ON DELETE CASCADE |
| tipo | TEXT | CHECK(tipo IN ('PDF','Imagen','Otro')) |
| ruta_archivo | TEXT | NOT NULL | Ruta relativa en disco local |
| hash_archivo | TEXT | NULL | Para validar integridad |
| creado_por | INTEGER | FK → usuarios.id |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 3.9 usuarios
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK |
| nombre | TEXT | NOT NULL |
| correo | TEXT | UNIQUE |
| rol | TEXT | CHECK(rol IN ('medico','asistente','admin')) |
| password_hash | TEXT | NOT NULL |
| activo | BOOLEAN | DEFAULT 1 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### 3.10 auditorias
| Columna | Tipo | Reglas | Descripción |
| --- | --- | --- | --- |
| id | INTEGER | PK |
| entidad | TEXT | NOT NULL |
| entidad_id | INTEGER | NOT NULL |
| accion | TEXT | CHECK(accion IN ('INSERT','UPDATE','DELETE')) |
| usuario_id | INTEGER | FK → usuarios.id |
| payload | TEXT | NULL | JSON con cambios |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

## 4. Relaciones e integridad referencial
- `pacientes` es la entidad raíz; todas las demás dependen directa o indirectamente de su clave primaria.
- `consultas` referencia pacientes y, a su vez, `consultas_mediciones` y `documentos_consulta` dependen de cada consulta mediante eliminación en cascada para mantener consistencia.
- Cada tipo de antecedentes usa una restricción UNIQUE en `paciente_id` para garantizar un solo registro editable por categoría; el frontend puede manejar formularios tipo ficha.
- `inmunizaciones` enlaza a `antecedentes_personales_no_patologicos` y permite cero o más entradas.

## 5. Índices recomendados
- `CREATE INDEX idx_consultas_paciente_fecha ON consultas(paciente_id, fecha_consulta DESC);`
- `CREATE INDEX idx_inmunizaciones_vacuna_fecha ON inmunizaciones(vacuna, fecha_aplicacion);`
- `CREATE INDEX idx_auditorias_entidad ON auditorias(entidad, entidad_id);`

## 6. Consideraciones adicionales
- SQLite no valida `BOOLEAN`; se usarán enteros (0/1) y se mapearán en la capa ORM.
- Los disparadores `AFTER UPDATE` en tablas principales actualizarán automáticamente `updated_at`.
- Para sincronización futura, considerar UUIDs (`TEXT`) alternos; pueden agregarse columnas `uuid DEFAULT (lower(hex(randomblob(4))...))` si se requiere replicación.
- Los respaldos se almacenarán en `database/backups/` (ya incluido en la estructura general) y los documentos impresos en `desktop/storage/` para mantener separada la evidencia clínica.

---
**Estructura de carpetas creada:**
```
backend/
  ├─ src/
  └─ tests/
frontend/
  ├─ src/
  └─ public/
database/
  ├─ migrations/
  └─ seeds/
desktop/
  └─ config/
scripts/
documentation/
  └─ base_datos.md (este documento)
```
Esta organización permitirá ubicar el código fuente futuro por dominio y mantener la documentación centralizada.
