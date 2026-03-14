# PROMPT.md - Instrucciones para replicar sistema de empaquetado

Este documento es una guia completa para que un asistente de IA adapte el sistema
de empaquetado de "Historia Clinica Pediatrica" a otro proyecto similar.

---

## Contexto del proyecto de referencia

Tengo un proyecto llamado "Historia Clinica Pediatrica" que funciona asi:

- **Frontend:** React 19 + Vite 8 + Tailwind CSS 3 (class-based dark mode) + Zustand + TanStack React Query v5
- **Backend:** Python 3.10+ + FastAPI 0.135 + SQLite 3 (WAL mode)
- **Auth:** JWT con python-jose, tokens de 24h, permisos granulares por modulo (lectura/escritura/actualizacion/eliminacion)
- **UI:** Dark mode con toggle sol/luna en TopBar, tema persistido en localStorage via Zustand
- **Empaquetado:** Un script Python que compila el frontend, copia el backend, la BD y genera archivos .bat para que el usuario final en Windows solo haga doble clic para instalar y usar

El sistema se empaqueta en una carpeta autocontenida que se copia a una PC con Windows. El usuario solo necesita instalar Python una vez. No necesita Node.js ni nada mas.

La base de datos original era Microsoft Access (.mdb). Se creo un script de migracion que lee Access con `mdbtools` y escribe en SQLite.

---

## Arquitectura del frontend

### Estructura de archivos
```
frontend/src/
├── main.jsx              # Entry point, importa theme store antes de render
├── App.jsx               # Rutas con React Router
├── index.css             # Tailwind + dark mode body/scrollbar styles
├── lib/
│   └── api.js            # Axios con interceptores JWT y redirect en 401
├── store/
│   ├── auth.js           # Zustand: token, user, permissions (localStorage)
│   └── theme.js          # Zustand: dark mode toggle (localStorage)
├── hooks/
│   └── useModulePermission.js  # Hook: { canRead, canWrite, canUpdate, canDelete }
├── components/
│   ├── PatientSearchSelect.jsx  # Buscador de pacientes con autocomplete
│   └── layout/
│       ├── DashboardLayout.jsx  # Sidebar + TopBar + contenido
│       ├── Sidebar.jsx          # Navegacion filtrada por permisos
│       └── TopBar.jsx           # Header con toggle dark mode + logout
└── pages/
    ├── LoginPage.jsx
    ├── PacientesPage.jsx             # Lista con paginacion server-side
    ├── PacienteDetallePage.jsx       # Detalle paciente con tabs (info, consultas, antecedentes)
    ├── ConsultasPage.jsx             # Lista consultas con paginacion
    ├── ConsultaDetallePage.jsx       # Detalle consulta compacto 2 columnas
    ├── AntecedentesPatologicosPage.jsx
    ├── AntecedentesNoPatologicosPage.jsx
    ├── AntecedentesHeredoFamiliaresPage.jsx
    └── UsuariosPage.jsx              # CRUD usuarios + tabla permisos
```

### Patrones clave del frontend

**Dark mode:**
- Tailwind configurado con `darkMode: 'class'` en `tailwind.config.js`
- Zustand store en `store/theme.js` persiste preferencia en localStorage (`pediatrico_dark`)
- Se importa en `main.jsx` ANTES del render para aplicar clase `dark` en `<html>` sin flash
- Toggle sol/luna en TopBar con iconos Sun/Moon de lucide-react
- CSS base: en `index.css` agregar `html.dark body { background: #0f172a; color: #e2e8f0; }`
- Mapeo de clases dark consistente:
  - `bg-white` → `dark:bg-slate-800`
  - `bg-[#f5f7f9]` → `dark:bg-slate-900`
  - `text-slate-800` → `dark:text-slate-100`
  - `text-slate-700` → `dark:text-slate-200`
  - `text-slate-600` → `dark:text-slate-300`
  - `text-slate-500` → `dark:text-slate-400`
  - `border-slate-100` → `dark:border-slate-700`
  - `border-slate-200` → `dark:border-slate-600`
  - `bg-slate-50` → `dark:bg-slate-700`
  - Badges: `bg-{color}-50 text-{color}-600` → `dark:bg-{color}-900/30 dark:text-{color}-400`

**Componente PatientSearchSelect:**
- Componente reutilizable en `components/PatientSearchSelect.jsx`
- Busqueda server-side con debounce 250ms contra `GET /api/pacientes?search=X&limit=15`
- Dropdown con resultados mostrando nombre, fecha nacimiento e ID
- Al seleccionar muestra chip con nombre del paciente y boton X para limpiar
- Props: `value` (paciente_id string), `onChange` (callback), `className`
- Usado en las 3 paginas standalone de antecedentes

**Formularios compactos (patron ConsultaDetallePage):**
- Labels: `text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500`
- Inputs: `text-xs px-2 py-1.5 rounded-lg` (no rounded-xl)
- Componentes MiniField/MiniSelect/MiniCheckbox para campos compactos
- Grid denso: `grid-cols-4 lg:grid-cols-7 gap-1.5`
- Cards: `rounded-xl p-4` (no rounded-2xl p-6)
- Botones: `text-xs py-1.5 rounded-lg`

**TanStack React Query v5 (IMPORTANTE):**
- `onSuccess` y `onError` fueron ELIMINADOS de `useQuery` en v5 (se ignoran silenciosamente)
- Usar `useEffect` para reaccionar a cambios de data:
  ```jsx
  const { data, isError } = useQuery({ queryKey: [...], queryFn: ... })
  useEffect(() => {
    if (data) { /* poblar formulario */ }
  }, [data, isError])
  ```
- `useMutation` SI conserva `onSuccess`/`onError` en v5
- QueryKeys compuestas: `['pacientes', search, page]`, `['antecedentes_pp', pacienteId]`

**Paginacion server-side:**
- Backend retorna `{ data: [...], total: N, page: P, limit: L }`
- Axios: `api.get('/pacientes').then(r => r.data)` retorna el objeto paginado
- Para obtener el array: `r.data.data` (primer `.data` es Axios, segundo es la propiedad del JSON)
- Frontend usa debounce de 300ms en search

---

## Tu proyecto es similar pero con estas diferencias

1. **La base de datos original es MySQL** (no Access)
2. **El destino sigue siendo SQLite** para el empaquetado portatil en Windows
3. **El proyecto genera PDFs desde el API** (hay endpoints que generan PDFs)
4. **Necesitas revisar tus propias dependencias** antes de empaquetar

---

## Tareas a realizar

### TAREA 1: Crear script de migracion MySQL → SQLite

Necesito un script `scripts/migrate_data.py` (o similar) que:

1. **Se conecte a MySQL** y lea todas las tablas relevantes
2. **Escriba los datos en SQLite** respetando las relaciones (foreign keys)
3. **Cree un schema SQLite** equivalente al de MySQL (script `migrate_structure.py`)
4. **Maneje las diferencias** entre MySQL y SQLite:
   - MySQL `AUTO_INCREMENT` → SQLite `AUTOINCREMENT`
   - MySQL `DATETIME` → SQLite `DATETIME` (texto ISO8601)
   - MySQL `BOOLEAN` → SQLite `INTEGER` (0/1)
   - MySQL `ENUM(...)` → SQLite `TEXT CHECK(...)`
   - MySQL `TEXT`/`LONGTEXT` → SQLite `TEXT`
   - MySQL `DECIMAL(x,y)` → SQLite `REAL`
   - MySQL `BLOB`/`LONGBLOB` → SQLite `BLOB`
   - Indices y constraints
5. **Cree usuarios por defecto** si la tabla de usuarios no existe o esta vacia
6. **Modo sin MySQL:** Si no se proporciona conexion MySQL, crear datos de ejemplo (seed data)

Dependencias para la migracion:
```
mysql-connector-python   # o pymysql
```

Ejemplo de estructura:
```python
# scripts/migrate_structure.py  → Crea el schema SQLite (CREATE TABLE, triggers, indices)
# scripts/migrate_data.py       → Lee MySQL y escribe en SQLite (o crea seed data)
```

### TAREA 2: Revisar dependencias del proyecto

**ESTO ES CRITICO.** Antes de empaquetar, revisa TODAS las dependencias del proyecto:

1. **Lee `requirements.txt`** (o `pyproject.toml` o `Pipfile`)
2. **Identifica CADA libreria** y para que se usa
3. **Presta atencion especial a:**

   **Librerias de generacion de PDF:**
   - `reportlab` — genera PDFs desde Python
   - `weasyprint` — convierte HTML a PDF (requiere dependencias del sistema: cairo, pango, etc.)
   - `fpdf2` — genera PDFs (sin dependencias del sistema)
   - `xhtml2pdf` / `pisa` — HTML a PDF
   - `wkhtmltopdf` — requiere binario del sistema instalado
   - `puppeteer`/`playwright` — requiere navegador headless

   **Si el proyecto usa `weasyprint`:**
   - En macOS: necesita `brew install cairo pango gdk-pixbuf libffi`
   - En Windows: necesita GTK3 runtime, lo cual es complejo
   - **Considera migrar a `fpdf2` o `reportlab`** que son pure Python y no requieren nada extra en Windows
   - Si DEBE seguir con weasyprint, documenta los pasos de instalacion de GTK3 en Windows

   **Si el proyecto usa `wkhtmltopdf`:**
   - Requiere instalar el binario por separado en Windows
   - Agrega instrucciones en el README.txt del build

   **Librerias de base de datos:**
   - `mysqlclient` / `mysql-connector-python` / `pymysql` — solo se necesitan para la MIGRACION, no para el empaquetado final
   - `sqlite3` — ya viene incluido en Python, no necesita instalacion
   - Si el proyecto usa un ORM (SQLAlchemy, Tortoise, etc.), verificar que soporte SQLite

   **Librerias con dependencias nativas (C extensions):**
   - `Pillow` — procesamiento de imagenes (puede necesitar libjpeg, libpng)
   - `cryptography` — puede requerir compilador C en Windows
   - `bcrypt` — compilacion nativa
   - `numpy`, `pandas` — heavy, verificar si realmente se necesitan

4. **Verifica compatibilidad de versiones:**

   Para Windows 10 (Python 3.10+):
   ```
   pip install <paquete>==<version>
   # Verificar que Requires-Python incluya >=3.10
   ```

   Para Windows 8 (Python 3.8):
   - Buscar la ULTIMA version de cada paquete que soporte Python 3.8
   - Ejemplo de versiones compatibles con Python 3.8:
     ```
     fastapi==0.124.0        # (0.125+ requiere 3.9+)
     uvicorn==0.33.0         # (0.34+ requiere 3.9+)
     python-jose==3.4.0      # (3.5+ requiere 3.9+)
     python-multipart==0.0.20 # (0.0.21+ requiere 3.10+)
     ```
   - Para verificar: `pip index versions <paquete>` o buscar en PyPI

5. **Separa dependencias de desarrollo vs produccion:**
   - El `requirements.txt` del build solo debe tener las de produccion
   - Las de migracion (mysql-connector, mdbtools) NO van en el build
   - Las de desarrollo (pytest, black, etc.) NO van en el build

### TAREA 3: Adaptar la conexion a base de datos

El backend actualmente se conecta a MySQL. Necesita poder conectarse a SQLite para el empaquetado.

Patron recomendado (de referencia):
```python
# backend/src/database.py
import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.environ.get("DB_PATH", "database/tu_base.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row      # Acceso por nombre de columna
    conn.execute("PRAGMA foreign_keys=ON;")  # Habilitar FK
    conn.execute("PRAGMA journal_mode=WAL;") # Mejor concurrencia
    return conn

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

**Si el proyecto usa un ORM (SQLAlchemy):**
```python
# Cambiar el connection string de MySQL a SQLite:
# MySQL:  mysql+pymysql://user:pass@localhost/dbname
# SQLite: sqlite:///database/tu_base.db
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///database/tu_base.db")
```

**Diferencias SQL entre MySQL y SQLite a revisar en el codigo:**
- `NOW()` → `datetime('now')` o `CURRENT_TIMESTAMP`
- `LIMIT x, y` → `LIMIT y OFFSET x`
- `IFNULL()` funciona igual
- `GROUP_CONCAT()` funciona igual
- `AUTO_INCREMENT` → `AUTOINCREMENT`
- MySQL `%s` placeholders → SQLite `?` placeholders (si usa SQL directo)
- `LIKE` es case-insensitive en MySQL pero case-sensitive en SQLite por defecto
  (usar `COLLATE NOCASE` o `LOWER()`)

### TAREA 4: Crear script de empaquetado

Crea `scripts/build_package.py` que haga:

```python
# Paso 1: Limpiar carpeta build/
# Paso 2: Compilar frontend (npm run build en carpeta frontend/)
# Paso 3: Copiar backend (sin __pycache__, sin .pyc)
# Paso 4: Copiar base de datos SQLite ya migrada
# Paso 5: Copiar scripts de migracion (respaldo)
# Paso 6: Crear requirements.txt SOLO con dependencias de produccion
# Paso 7: Crear setup.bat, run.bat, README.txt
```

**setup.bat** debe:
- Verificar que Python esta instalado
- Crear un entorno virtual (.venv)
- Instalar dependencias desde requirements.txt
- Si el proyecto usa weasyprint: tambien instalar GTK3

**run.bat** debe:
- Activar el .venv
- Verificar que la BD existe
- Iniciar uvicorn apuntando al main.py
- Abrir el navegador automaticamente

**README.txt** debe ser MUY detallado para alguien sin experiencia tecnica:
- Paso a paso como instalar Python (con capturas mentales de cada pantalla)
- Enfasis en "Add Python to PATH"
- Como ejecutar setup.bat y run.bat
- Credenciales por defecto
- Como respaldar la base de datos
- Problemas comunes y soluciones
- Si necesita dependencias extra del sistema (GTK3, wkhtmltopdf), explicar CADA paso

**Para Windows 8** crear un segundo script `build_package_win8.py`:
- Misma estructura pero con requirements.txt usando versiones compatibles con Python 3.8
- README.txt indicando que debe instalar Python 3.8.20 especificamente
- Link directo: https://www.python.org/downloads/release/python-3820/
- Explicar como saber si su PC es 32 o 64 bits

### TAREA 5: Servir el frontend como SPA desde FastAPI

En produccion (empaquetado), FastAPI sirve el frontend compilado:

```python
# En main.py, al final:
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = os.path.join(os.path.dirname(...), "static")

if os.path.isdir(STATIC_DIR):
    # Servir archivos estáticos (JS, CSS, imagenes)
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    # Cualquier ruta que no sea /api → index.html (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
```

Esto permite que en Windows el usuario solo abra `http://localhost:8000` y vea todo.
No necesita Node.js ni servidor de frontend separado.

### TAREA 6: Verificar la generacion de PDFs

Como el proyecto genera PDFs, hay que asegurarse de que:

1. **La libreria de PDFs funcione en Windows sin dependencias extra del sistema**
   - `reportlab`: OK, pure Python
   - `fpdf2`: OK, pure Python
   - `weasyprint`: PROBLEMATICO, necesita cairo/pango/GTK3
   - `wkhtmltopdf`: necesita binario instalado

2. **Los PDFs se generen correctamente con la BD en SQLite**
   - Verifica que las queries SQL usadas para generar PDFs sean compatibles con SQLite
   - Verifica que los paths de fuentes/imagenes sean relativos (no absolutos)

3. **Prueba la generacion de PDF en el empaquetado**
   - Verifica que el endpoint de PDF funcione correctamente
   - Si usa templates HTML, asegurate de que se copien al build

### TAREA 7: Implementar dark mode (si aplica)

Si quieres agregar dark mode como en el proyecto de referencia:

1. **Tailwind config:** Agregar `darkMode: 'class'` en `tailwind.config.js`
2. **Theme store:** Crear `store/theme.js` con Zustand:
   ```js
   import { create } from 'zustand'
   const useThemeStore = create((set) => ({
     dark: localStorage.getItem('app_dark') === 'true',
     toggle: () => set((state) => {
       const next = !state.dark
       localStorage.setItem('app_dark', String(next))
       document.documentElement.classList.toggle('dark', next)
       return { dark: next }
     }),
   }))
   // Aplicar preferencia guardada antes del render
   if (localStorage.getItem('app_dark') === 'true') {
     document.documentElement.classList.add('dark')
   }
   export default useThemeStore
   ```
3. **Importar en main.jsx** ANTES de App: `import './store/theme'`
4. **Toggle en TopBar:** Boton con iconos Sun/Moon de lucide-react
5. **CSS base:** En index.css agregar `html.dark body { background: #0f172a; color: #e2e8f0; }`
6. **IMPORTANTE:** Despues de modificar `tailwind.config.js`, reiniciar el dev server de Vite

### TAREA 8: Componente de busqueda de pacientes reutilizable

Si tu proyecto tiene seleccion de pacientes en multiples paginas, crea un componente reutilizable:

```jsx
// components/PatientSearchSelect.jsx
// - Input de busqueda con debounce (250ms)
// - Busqueda server-side: GET /api/pacientes?search=X&limit=15
// - Dropdown con resultados (nombre, fecha nacimiento, ID)
// - Al seleccionar: muestra chip con nombre + boton X para limpiar
// - Carga info del paciente seleccionado via GET /api/pacientes/:id
// - Props: value (string id), onChange (callback), className
```

Esto elimina la necesidad de cargar TODOS los pacientes en un dropdown `<select>`, lo cual no escala con miles de registros.

---

## Estructura final esperada del build

```
build/HistorialClinico/              (o como se llame tu proyecto)
├── setup.bat                        # Instalar (1 vez)
├── run.bat                          # Iniciar sistema
├── README.txt                       # Guia detallada para usuario no tecnico
├── requirements.txt                 # Solo dependencias de produccion
├── backend/                         # Codigo FastAPI
│   ├── __init__.py
│   └── src/
│       ├── main.py
│       ├── database.py              # Conexion SQLite (NO MySQL)
│       ├── auth.py
│       └── routers/
├── database/                        # SQLite
│   ├── tu_base.db
│   └── backups/
├── static/                          # Frontend compilado (npm run build)
│   ├── index.html
│   └── assets/
└── scripts/                         # Respaldo
    ├── migrate_structure.py
    └── migrate_data.py
```

---

## Gotchas y lecciones aprendidas

### TanStack React Query v5
- `onSuccess`/`onError` en `useQuery` fueron ELIMINADOS silenciosamente. No dan error, simplemente se ignoran.
- Solucion: usar `useEffect` que observe `data` e `isError` del query.
- `useMutation` SI conserva `onSuccess`/`onError`.

### Paginacion en API de pacientes
- El endpoint `GET /api/pacientes` retorna `{ data: [...], total, page, limit }`, NO un array directo.
- En Axios: `api.get('/pacientes').then(r => r.data)` retorna el objeto paginado.
- Para obtener el array: `r.data.data` (primer `.data` es Axios, segundo es la propiedad del JSON).

### Tailwind dark mode y Vite
- Despues de agregar `darkMode: 'class'` al tailwind.config.js, el dev server de Vite DEBE reiniciarse.
- En dev, HMR no recoge cambios al config de Tailwind/PostCSS.
- Verificar con build: `npm run build` y buscar `dark:` en el CSS generado.

### Sidebar ya es oscuro
- Si el Sidebar usa `bg-slate-900` (tema oscuro nativo), no necesita clases `dark:`.

### Permisos: backend vs frontend
- Backend: endpoints clinicos usan `require_permission()`, endpoints de usuarios usan `require_admin`.
- Frontend: paginas clinicas usan `useModulePermission()`, UsuariosPage usa `isAdmin`.
- Mantener esta distincion. No mezclar.

---

## Checklist antes de entregar

- [ ] `migrate_structure.py` crea el schema SQLite correctamente
- [ ] `migrate_data.py` lee MySQL y escribe en SQLite sin errores
- [ ] `migrate_data.py` sin MySQL crea datos de ejemplo (seed)
- [ ] Backend arranca con SQLite (no intenta conectar a MySQL)
- [ ] Todas las queries SQL son compatibles con SQLite
- [ ] Generacion de PDFs funciona con SQLite
- [ ] PDFs no dependen de binarios del sistema (o estan documentados)
- [ ] `requirements.txt` del build NO incluye mysql-connector ni deps de desarrollo
- [ ] `requirements.txt` solo tiene dependencias que funcionan en Windows
- [ ] `build_package.py` genera el build completo sin errores
- [ ] `setup.bat` instala correctamente en Windows 10 con Python 3.10+
- [ ] `run.bat` inicia el servidor y abre el navegador
- [ ] README.txt explica TODO paso a paso para usuario no tecnico
- [ ] Si hay build Win8: `requirements.txt` usa versiones Python 3.8-compatible
- [ ] Frontend SPA se sirve correctamente desde FastAPI en produccion
- [ ] Login funciona con credenciales por defecto
- [ ] CORS no bloquea nada en modo produccion (todo es localhost:8000)
- [ ] Dark mode funciona y persiste entre recargas
- [ ] Selector de pacientes busca server-side (no carga todos en memoria)
- [ ] `.gitignore` excluye .env, credenciales, certificados, BD y node_modules

---

## Referencia: Proyecto "Historia Clinica Pediatrica"

Si necesitas ver como se hizo en el proyecto de referencia, estos son los archivos clave:

**Empaquetado y migracion:**
- `scripts/build_package.py` — Script de empaquetado para Windows 10
- `scripts/build_package_win8.py` — Script de empaquetado para Windows 8
- `scripts/migrate_structure.py` — Crea schema SQLite
- `scripts/migrate_data.py` — Migra desde Access a SQLite (o crea seed data)

**Backend:**
- `backend/src/main.py` — FastAPI + servir SPA en produccion
- `backend/src/database.py` — Conexion SQLite con context manager
- `backend/src/auth.py` — JWT + permisos
- `backend/src/routers/` — Un archivo por entidad (pacientes, consultas, antecedentes, etc.)

**Frontend - Infraestructura:**
- `frontend/tailwind.config.js` — Config con darkMode: 'class' y colores custom
- `frontend/src/main.jsx` — Entry point (importa theme store antes de render)
- `frontend/src/index.css` — Tailwind base + dark body + scrollbar styles
- `frontend/src/App.jsx` — Rutas con React Router
- `frontend/src/store/auth.js` — Zustand: autenticacion y permisos
- `frontend/src/store/theme.js` — Zustand: dark mode toggle con localStorage
- `frontend/src/lib/api.js` — Axios con interceptores JWT
- `frontend/src/hooks/useModulePermission.js` — Hook de permisos por modulo

**Frontend - Componentes reutilizables:**
- `frontend/src/components/PatientSearchSelect.jsx` — Buscador de pacientes con autocomplete
- `frontend/src/components/layout/DashboardLayout.jsx` — Layout principal
- `frontend/src/components/layout/Sidebar.jsx` — Navegacion filtrada por permisos
- `frontend/src/components/layout/TopBar.jsx` — Header con dark mode toggle + user info

**Frontend - Paginas (ejemplos de patrones):**
- `frontend/src/pages/ConsultaDetallePage.jsx` — Formulario compacto 2 columnas con MiniField
- `frontend/src/pages/PacienteDetallePage.jsx` — Page con tabs y sub-componentes inline
- `frontend/src/pages/PacientesPage.jsx` — Tabla con paginacion server-side y debounce
- `frontend/src/pages/AntecedentesNoPatologicosPage.jsx` — Formulario compacto con inmunizaciones inline
- `frontend/src/pages/AntecedentesPatologicosPage.jsx` — Formulario compacto grid 2 columnas
- `frontend/src/pages/AntecedentesHeredoFamiliaresPage.jsx` — Formulario compacto grid 2 columnas
- `frontend/src/pages/UsuariosPage.jsx` — CRUD con modal y tabla de permisos

**Documentacion:**
- `CLAUDE.md` — Contexto completo del proyecto para asistentes IA
- `PROMPT.md` — Este archivo (guia de replicacion)
- `database/README.md` — Schema de la BD documentado
- `.gitignore` — Excluye secrets, BD, node_modules, .venv, .claude

Todos estos archivos estan en el repositorio y pueden servir como plantilla.
