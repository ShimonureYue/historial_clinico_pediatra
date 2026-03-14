# Historia Clinica Pediatrica

Sistema web para el control de historial clinico de pacientes de pediatria. Migrado del sistema original en Visual Basic / Access a una arquitectura moderna: **React 19 + Tailwind CSS** (frontend), **Python FastAPI** (backend) y **SQLite** (base de datos).

## Estructura del Proyecto

```
historial_beto_claude/
├── backend/                              # FastAPI + SQLite
│   ├── src/
│   │   ├── main.py                      # App FastAPI, CORS, routers, serve SPA
│   │   ├── auth.py                      # JWT auth, require_permission, require_admin
│   │   ├── database.py                  # Conexion SQLite (WAL, FK, context manager)
│   │   └── routers/
│   │       ├── auth_router.py           # POST /api/auth/login
│   │       ├── pacientes_router.py      # CRUD pacientes (paginado + busqueda)
│   │       ├── consultas_router.py      # CRUD consultas (paginado + busqueda)
│   │       ├── antecedentes_pp_router.py    # Antecedentes patologicos
│   │       ├── antecedentes_pnp_router.py   # Antecedentes no patologicos + inmunizaciones
│   │       ├── antecedentes_hf_router.py    # Antecedentes heredo familiares
│   │       ├── usuarios_router.py       # CRUD usuarios + permisos (solo admin)
│   │       └── tratamientos_router.py   # Medicamentos por consulta
│   └── requirements.txt
├── frontend/                             # React 19 + Vite 8 + Tailwind CSS 3
│   ├── src/
│   │   ├── main.jsx                     # Entry point React
│   │   ├── App.jsx                      # Rutas (react-router-dom)
│   │   ├── components/layout/
│   │   │   ├── DashboardLayout.jsx      # Shell principal con Outlet
│   │   │   ├── Sidebar.jsx              # Menu lateral (filtrado por permisos)
│   │   │   └── TopBar.jsx               # Barra superior + toggle dark mode
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx            # Login con JWT
│   │   │   ├── PacientesPage.jsx        # Lista paginada + busqueda nombre completo
│   │   │   ├── PacienteDetallePage.jsx  # Detalle paciente + antecedentes + consultas
│   │   │   ├── ConsultasPage.jsx        # Lista paginada + busqueda
│   │   │   ├── ConsultaDetallePage.jsx  # Detalle consulta + mediciones + tratamientos
│   │   │   ├── AntecedentesPatologicosPage.jsx
│   │   │   ├── AntecedentesNoPatologicosPage.jsx
│   │   │   ├── AntecedentesHeredoFamiliaresPage.jsx
│   │   │   └── UsuariosPage.jsx         # Gestion usuarios + matriz de permisos
│   │   ├── routes/
│   │   │   └── ProtectedRoute.jsx       # Proteccion JWT
│   │   ├── hooks/
│   │   │   └── useModulePermission.js   # Hook permisos por modulo
│   │   ├── components/
│   │   │   └── PatientSearchSelect.jsx  # Busqueda de pacientes con autocomplete
│   │   ├── store/
│   │   │   ├── auth.js                  # Zustand: token, user, permissions
│   │   │   └── theme.js                 # Zustand: dark mode (persiste en localStorage)
│   │   └── lib/
│   │       └── api.js                   # Axios + interceptores JWT/401
│   ├── package.json
│   └── dist/                            # Build de produccion (generado)
├── database/
│   ├── historial_pediatrico.db          # Base de datos SQLite
│   ├── README.md                        # Documentacion del esquema
│   ├── backups/
│   ├── migrations/
│   └── seeds/
├── scripts/
│   ├── migrate_structure.py             # Crea esquema SQLite (tablas, triggers, indices)
│   ├── migrate_data.py                  # Migra datos desde Access o crea datos ejemplo
│   └── build_package.py                 # Empaqueta para distribucion Windows
├── documentation/
│   ├── base_datos.md                    # Modelo relacional original
│   └── beto/                            # Capturas del sistema VB original
├── build/                               # Paquete Windows (generado)
│   └── HistorialPediatrico/
└── CLAUDE.md                            # Guia para desarrollo con IA
```

## Modulos del Sistema

| Modulo | Descripcion | Permiso backend |
|--------|-------------|-----------------|
| **Pacientes** | Ficha de identificacion (nombre, fecha nacimiento, sexo, direccion, responsable) | `pacientes` |
| **Consultas** | Visitas medicas con exploracion fisica (signos vitales + exploracion por region) | `consultas` |
| **Tratamientos** | Medicamentos prescritos por consulta (nombre, dosis, via, duracion) | `consultas` |
| **A. Patologicos** | Enfermedades exantematicas, alergias, cirugias | `antecedentes_pp` |
| **A. No Patologicos** | Datos perinatales, inmunizaciones, tipo sangre, desarrollo psicomotor | `antecedentes_pnp` |
| **A. Heredo Familiares** | Patologias de familiares (abuelos, padres, hermanos) | `antecedentes_hf` |
| **Usuarios** | Gestion de usuarios con permisos granulares por modulo | `usuarios` |
| **Reportes** | Reportes e impresion (pendiente) | `reportes` |

## Sistema de Permisos (RBAC)

### Roles
- **admin** - Acceso total. Unico que puede crear/editar/eliminar usuarios.
- **medico** - Acceso clinico completo (pacientes, consultas, antecedentes).
- **asistente** - Acceso limitado segun permisos asignados.

### Permisos por modulo
Cada usuario tiene permisos independientes por modulo (7 modulos x 4 operaciones):

| Operacion | Descripcion | Efecto backend |
|-----------|-------------|----------------|
| **lectura** | Puede ver informacion | `require_permission(modulo, "lectura")` |
| **escritura** | Puede crear registros | `require_permission(modulo, "escritura")` |
| **actualizacion** | Puede editar registros | `require_permission(modulo, "actualizacion")` |
| **eliminacion** | Puede borrar registros | `require_permission(modulo, "eliminacion")` |

### Enforcement
- **Backend**: Cada endpoint tiene un `Depends(require_permission(...))` o `Depends(require_admin)`.
- **Frontend**: El sidebar filtra modulos por `lectura`. Los botones crear/editar/eliminar se muestran segun permiso. En usuarios, solo `isAdmin` ve los botones de gestion.

---

## API Endpoints

### Autenticacion
| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → `{ access_token, user, permissions }` |
| GET | `/api/health` | Health check |

### Pacientes
| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| GET | `/api/pacientes?search=&page=&limit=` | Lista paginada, busqueda por nombre completo o ID | lectura |
| GET | `/api/pacientes/{id}` | Detalle paciente | lectura |
| POST | `/api/pacientes` | Crear paciente | escritura |
| PUT | `/api/pacientes/{id}` | Editar paciente | actualizacion |
| DELETE | `/api/pacientes/{id}` | Eliminar paciente | eliminacion |

### Consultas
| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| GET | `/api/consultas?search=&page=&limit=` | Lista paginada con busqueda | lectura |
| GET | `/api/consultas/{id}` | Detalle con mediciones | lectura |
| GET | `/api/consultas/paciente/{paciente_id}` | Consultas de un paciente | lectura |
| POST | `/api/consultas` | Crear consulta + mediciones | escritura |
| PUT | `/api/consultas/{id}` | Editar consulta | actualizacion |
| DELETE | `/api/consultas/{id}` | Eliminar consulta | eliminacion |

### Tratamientos
| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| GET | `/api/tratamientos/consulta/{consulta_id}` | Listar por consulta | consultas.lectura |
| POST | `/api/tratamientos` | Crear tratamiento | consultas.escritura |
| PUT | `/api/tratamientos/bulk/{consulta_id}` | Reemplazar todos de una consulta | consultas.actualizacion |
| DELETE | `/api/tratamientos/{id}` | Eliminar tratamiento | consultas.eliminacion |

### Antecedentes Patologicos
| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| GET | `/api/antecedentes-patologicos/paciente/{id}` | Obtener por paciente | lectura |
| POST | `/api/antecedentes-patologicos` | Crear | escritura |
| PUT | `/api/antecedentes-patologicos/{id}` | Editar | actualizacion |

### Antecedentes No Patologicos
| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| GET | `/api/antecedentes-no-patologicos/paciente/{id}` | Obtener + inmunizaciones | lectura |
| POST | `/api/antecedentes-no-patologicos` | Crear + inmunizaciones | escritura |
| PUT | `/api/antecedentes-no-patologicos/{id}` | Editar + inmunizaciones | actualizacion |

### Antecedentes Heredo Familiares
| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| GET | `/api/antecedentes-heredo-familiares/paciente/{id}` | Obtener por paciente | lectura |
| POST | `/api/antecedentes-heredo-familiares` | Crear | escritura |
| PUT | `/api/antecedentes-heredo-familiares/{id}` | Editar | actualizacion |

### Usuarios (solo admin para escritura)
| Metodo | Ruta | Descripcion | Permiso |
|--------|------|-------------|---------|
| GET | `/api/usuarios` | Listar con permisos | usuarios.lectura |
| GET | `/api/usuarios/{id}` | Detalle usuario | usuarios.lectura |
| POST | `/api/usuarios` | Crear usuario | require_admin |
| PUT | `/api/usuarios/{id}` | Editar usuario | require_admin |
| DELETE | `/api/usuarios/{id}` | Eliminar usuario (no a si mismo) | require_admin |

Todos los endpoints (excepto login y health) requieren JWT: `Authorization: Bearer <token>`

---

## Caracteristicas del Frontend

### Dark Mode
El sistema soporta modo oscuro completo:
- Configurado con `darkMode: 'class'` en `tailwind.config.js`
- Estado gestionado por Zustand en `store/theme.js`, persistido en `localStorage`
- Toggle en la barra superior (`TopBar.jsx`) con icono sol/luna
- Todas las clases Tailwind incluyen variantes `dark:` explicitas

### Busqueda de Pacientes (PatientSearchSelect)
Las paginas de antecedentes usan un componente reutilizable de busqueda con autocomplete en lugar de dropdowns `<select>`:
- Busqueda server-side con debounce de 250ms contra `GET /api/pacientes?search=X&limit=15`
- Dropdown con resultados que muestra nombre completo y fecha de nacimiento
- Al seleccionar, muestra chip con nombre del paciente y boton X para limpiar
- Componente: `frontend/src/components/PatientSearchSelect.jsx`

### Formularios Compactos
Las paginas de antecedentes y detalle de consulta usan un diseno compacto:
- Labels: `text-[10px]` uppercase con iconos descriptivos
- Inputs: `text-xs py-1.5 rounded-lg` con bordes sutiles
- Layout: grids de 2 columnas en pantallas medianas (`grid-cols-1 sm:grid-cols-2`)
- Dark mode completo en todos los campos

---

## Rutas Frontend

| Ruta | Pagina | Permiso requerido |
|------|--------|-------------------|
| `/login` | LoginPage | Publica |
| `/pacientes` | PacientesPage | pacientes.lectura |
| `/pacientes/:id` | PacienteDetallePage | pacientes.lectura |
| `/consultas` | ConsultasPage | consultas.lectura |
| `/consultas/:id` | ConsultaDetallePage | consultas.lectura |
| `/antecedentes-patologicos` | AntecedentesPatologicosPage | antecedentes_pp.lectura |
| `/antecedentes-no-patologicos` | AntecedentesNoPatologicosPage | antecedentes_pnp.lectura |
| `/antecedentes-heredo-familiares` | AntecedentesHeredoFamiliaresPage | antecedentes_hf.lectura |
| `/usuarios` | UsuariosPage | usuarios.lectura |

---

## Uso en Local (Desarrollo - macOS)

### Requisitos
- Python 3.10+
- Node.js 20+ (via nvm)

### 1. Configurar entorno

```bash
# Python
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Node.js
source ~/.nvm/nvm.sh && nvm use 20
cd frontend && npm install && cd ..
```

### 2. Migrar base de datos

```bash
source .venv/bin/activate

# Crear estructura (tablas, triggers, indices)
python scripts/migrate_structure.py

# Opcion A: Migrar desde Access
python scripts/migrate_data.py --access /ruta/a/tu_base.mdb

# Opcion B: Datos de ejemplo
python scripts/migrate_data.py
```

### 3. Iniciar servidores

**Backend** (terminal 1):
```bash
source .venv/bin/activate
uvicorn backend.src.main:app --reload --port 8000
```

**Frontend** (terminal 2):
```bash
cd frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run dev
```

Acceder en: `http://localhost:5173`

### Credenciales por defecto
| Usuario | Correo | Contrasena | Rol |
|---------|--------|------------|-----|
| Administrador | admin@clinica.com | admin123 | admin (todos los permisos) |
| Dr. Roberto Garcia | doctor@clinica.com | doctor123 | medico (permisos clinicos) |

---

## Empaquetar para Windows

El sistema se empaqueta en una carpeta autocontenida que se copia a cualquier PC con Windows. El usuario final solo necesita instalar Python (no necesita Node.js ni nada mas).

Hay **dos scripts de empaquetado** segun la version de Windows destino:

| Script | Windows | Python requerido | Carpeta generada |
|--------|---------|------------------|------------------|
| `scripts/build_package.py` | Windows 10+ | 3.10+ | `build/HistorialPediatrico/` |
| `scripts/build_package_win8.py` | Windows 8/8.1 | 3.8.x | `build/HistorialPediatrico_Win8/` |

La diferencia es que Windows 8 requiere Python 3.8 (la ultima version compatible) y las dependencias se pinean a versiones que soportan esa version de Python.

### Que hace cada script de empaquetado

Ambos scripts ejecutan los mismos 6 pasos:

1. **Limpia** la carpeta build anterior
2. **Compila el frontend** (`npm run build` → archivos estaticos en `static/`)
3. **Copia el backend** (codigo Python sin `__pycache__`)
4. **Copia la base de datos** SQLite ya migrada
5. **Copia scripts de migracion** como respaldo
6. **Genera archivos Windows:**
   - `setup.bat` — crea `.venv` e instala dependencias (ejecutar 1 vez)
   - `run.bat` — activa el entorno, inicia uvicorn y abre el navegador
   - `README.txt` — guia paso a paso para usuario sin experiencia tecnica

### Dependencias por version

**Windows 10+ (Python 3.10+):**
```
fastapi==0.135.1
uvicorn==0.41.0
python-jose[cryptography]==3.5.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.22
```

**Windows 8 (Python 3.8):**
```
fastapi==0.124.0
uvicorn==0.33.0
python-jose[cryptography]==3.4.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.20
```

### Contenido del build generado

```
build/HistorialPediatrico/           (32.6 MB)
├── setup.bat                        # Instalar (doble clic, 1 vez)
├── run.bat                          # Iniciar sistema (doble clic)
├── README.txt                       # Guia detallada para usuario final
├── requirements.txt                 # Dependencias Python
├── backend/          (60 KB)        # Codigo FastAPI
├── database/         (32 MB)        # SQLite con datos migrados
├── static/          (468 KB)        # Frontend React compilado
└── scripts/          (44 KB)        # migrate_structure.py + migrate_data.py
```

En produccion, FastAPI sirve el frontend compilado como SPA (sin necesidad de Node.js). Todo corre en `http://localhost:8000`.

### Flujo completo

```
macOS (desarrollo)                       Windows (produccion)
──────────────────                       ────────────────────

1. Migrar Access → SQLite
2. Empaquetar (build_package.py)    →    3. Copiar carpeta a la PC
                                         4. Instalar Python (1 vez)
                                         5. setup.bat (1 vez)
                                         6. run.bat (cada uso)
```

### Paso 1: Migrar la base de datos final

```bash
source .venv/bin/activate
rm -f database/historial_pediatrico.db
python scripts/migrate_structure.py
python scripts/migrate_data.py --access /ruta/a/base_final.mdb
```

### Paso 2: Empaquetar

```bash
source ~/.nvm/nvm.sh && nvm use 20
source .venv/bin/activate

# Para Windows 10+
python scripts/build_package.py

# Para Windows 8
python scripts/build_package_win8.py
```

### Paso 3: Desplegar en Windows

1. Copiar la carpeta del build a la PC Windows (USB, red, etc.)
2. **Instalar Python** (solo la primera vez):
   - Windows 10+: descargar desde https://www.python.org/downloads/
   - Windows 8: descargar Python 3.8.20 desde https://www.python.org/downloads/release/python-3820/
   - **MUY IMPORTANTE:** Marcar la casilla **"Add Python to PATH"** durante la instalacion
3. Doble clic en `setup.bat` (solo la primera vez — instala dependencias)
4. Doble clic en `run.bat` para iniciar el sistema
5. Se abre el navegador en `http://localhost:8000`

### Notas para Windows
- No cerrar la ventana CMD (consola negra) mientras se usa el sistema
- Detener: cerrar la ventana o presionar `Ctrl+C`
- Base de datos en: `database\historial_pediatrico.db`
- Respaldar: copiar el archivo `.db` cuando el sistema NO este corriendo
- Si Windows Defender bloquea: clic en "Mas informacion" → "Ejecutar de todas formas"

---

## Tecnologias

| Capa | Tecnologias |
|------|-------------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 3, Zustand 5, TanStack React Query 5, Axios, Lucide React, React Router 7, React Hot Toast, Headless UI, clsx |
| **Backend** | Python 3.10+, FastAPI 0.135, SQLite 3 (WAL mode), python-jose (JWT), passlib + bcrypt |
| **Herramientas** | nvm (Node 20), venv (Python), mdbtools (migracion Access) |

## Datos migrados (produccion)

El sistema fue migrado desde una base Access con:
- **8,282** pacientes
- **35,917** consultas medicas
- Antecedentes patologicos, no patologicos y heredo familiares
- Inmunizaciones por paciente
