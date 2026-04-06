# CLAUDE.md - Historia Clinica Pediatrica

Guia de contexto para desarrollo asistido con IA en este proyecto.

## Que es este proyecto

Sistema web de historial clinico pediatrico. Migrado de Visual Basic + Access a una arquitectura moderna. Se usa en una clinica real con ~8,200 pacientes y ~35,900 consultas.

## Stack tecnologico

- **Frontend:** React 19 + Vite 8 + Tailwind CSS 3 + Zustand + TanStack React Query v5
- **Backend:** Python 3.14+ + FastAPI 0.135 + SQLite 3 (WAL mode)
- **Auth:** JWT con python-jose, tokens de 24h
- **Empaquetado:** Build de produccion servido por FastAPI como SPA en Windows

## Comandos frecuentes

```bash
# Backend
source .venv/bin/activate
uvicorn backend.src.main:app --reload --port 8000

# Frontend
cd frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run dev

# Migracion
python scripts/migrate_structure.py
python scripts/migrate_data.py --access /ruta/base.mdb

# Build produccion
python scripts/build_package.py
```

## Arquitectura

### Backend (FastAPI)

- Entry point: `backend/src/main.py`
- Todos los routers en `backend/src/routers/`
- Prefijos API: `/api/auth`, `/api/pacientes`, `/api/consultas`, `/api/antecedentes-*`, `/api/usuarios`, `/api/tratamientos`
- Base de datos: `backend/src/database.py` — context manager `get_db()` con auto-commit/rollback
- Auth: `backend/src/auth.py` — `get_current_user`, `require_permission(modulo, tipo)`, `require_admin`

### Frontend (React)

- Entry: `frontend/src/main.jsx` → `App.jsx` (rutas)
- Layout: `DashboardLayout` con `Sidebar` (filtrado por permisos) + `TopBar` (con toggle dark mode)
- State: Zustand en `store/auth.js` (token, user, permissions en localStorage) + `store/theme.js` (dark mode)
- API: Axios en `lib/api.js` con interceptores JWT y redirect en 401
- Permisos: Hook `useModulePermission(modulo)` → `{ canRead, canWrite, canUpdate, canDelete }`
- Datos: TanStack React Query v5 con queryKeys como `['pacientes', search, page]`
- Componentes reutilizables: `PatientSearchSelect` (búsqueda de pacientes con autocomplete)

### Base de datos (SQLite)

- 13 tablas. Esquema completo en `scripts/migrate_structure.py`
- Documentacion detallada en `database/README.md`
- Tablas principales: `pacientes`, `consultas`, `consultas_mediciones`, `tratamientos`
- Antecedentes: `antecedentes_personales_patologicos`, `antecedentes_personales_no_patologicos`, `antecedentes_heredo_familiares`, `inmunizaciones`
- Auth: `usuarios`, `permisos` (catalogo 7 modulos), `usuario_permisos`
- Pendientes: `documentos_consulta`, `auditorias` (tablas creadas, sin implementar en backend/frontend)
- Foreign keys con CASCADE DELETE habilitadas
- Triggers para auto-update de `updated_at`

## Patrones importantes

### Paginacion server-side
Pacientes y consultas usan paginacion en backend:
```
GET /api/pacientes?search=texto&page=1&limit=50
→ { data: [...], total: N, page: P, limit: L }
```
Frontend usa debounce de 300ms en search con React Query queryKey que incluye `[entity, search, page]`.

### Busqueda de pacientes
La busqueda concatena nombre completo: `nombre || ' ' || apellido_paterno || ' ' || apellido_materno` para permitir buscar "Juan Perez" como texto completo. Tambien busca individualmente por cada campo y por ID.

### Permisos - Backend
- Endpoints clinicos: `Depends(require_permission("modulo", "tipo"))`
- Endpoints de usuarios (POST/PUT/DELETE): `Depends(require_admin)` — solo rol admin
- Endpoints de usuarios (GET): `Depends(require_permission("usuarios", "lectura"))`

### Permisos - Frontend
- Sidebar: filtra items por `permissions[modulo]?.lectura`
- Paginas clinicas: usa `useModulePermission(modulo)` para mostrar/ocultar botones
- UsuariosPage: usa `isAdmin = user?.rol === 'admin'` para botones crear/editar/eliminar (alineado con backend `require_admin`)

### Busqueda de pacientes en formularios (PatientSearchSelect)
Las paginas de antecedentes usan el componente `PatientSearchSelect` (`components/PatientSearchSelect.jsx`) en lugar de dropdowns `<select>`. Busqueda server-side con debounce de 250ms contra `GET /api/pacientes?search=X&limit=15`. Muestra chip con nombre del paciente seleccionado y boton X para limpiar.

### Antecedentes
Cada tipo de antecedente es 1:1 con paciente (`paciente_id UNIQUE`). El frontend hace GET por paciente_id y si no existe muestra formulario vacio. Al guardar, decide si POST (crear) o PUT (actualizar) segun si ya existe un registro.

### Inmunizaciones
Son hijas de `antecedentes_personales_no_patologicos`. Se envian como array nested en el JSON del antecedente. El backend hace DELETE + INSERT de todas las inmunizaciones en cada update (replace pattern).

### Tratamientos
Similares a inmunizaciones pero vinculados a `consultas`. Endpoint bulk `PUT /api/tratamientos/bulk/{consulta_id}` reemplaza todos los tratamientos de una consulta.

## Convenciones de codigo

### Backend
- Un archivo por router en `backend/src/routers/`
- Modelos Pydantic definidos dentro de cada router (no en carpeta models separada)
- SQL directo con parametros `?` (sin ORM)
- `conn.execute()` con `sqlite3.Row` para dict-like access
- Respuestas: `{"id": N, "message": "..."}` para create, `{"message": "..."}` para update/delete
- Errores: `HTTPException(status_code=4xx, detail="mensaje en espanol")`

### Frontend
- Paginas en `pages/`, componentes en `components/`
- Cada pagina maneja su propio CRUD con React Query mutations
- Formularios en modales (modal overlay con form)
- Toast notifications con react-hot-toast
- Estilos: clases Tailwind inline, `clsx()` para condicionales
- Iconos: lucide-react
- Dark mode: `darkMode: 'class'` en tailwind.config.js, Zustand store en `store/theme.js`, toggle en TopBar
- Formularios compactos: labels `text-[10px]` uppercase, inputs `text-xs py-1.5 rounded-lg`, grids de 2 columnas

## Gotchas y lecciones aprendidas

- **TanStack React Query v5**: `onSuccess`/`onError` fueron removidos de `useQuery`. Usar `useEffect` observando `data` e `isError` en su lugar.
- **API de pacientes paginada**: `GET /api/pacientes` retorna `{ data: [...], total, page, limit }`, NO un array directo. Para obtener la lista: `r.data.data`.
- **Tailwind config changes**: Cambios en `tailwind.config.js` requieren reiniciar el dev server de Vite (HMR no los detecta).
- **Dark mode**: Todas las clases Tailwind deben tener variante `dark:` explícita. El store `theme.js` aplica/remueve la clase `dark` en `document.documentElement`.

## Tablas/funcionalidad pendiente de implementar

- **documentos_consulta** — tabla existe, falta backend router + frontend para subir/ver archivos adjuntos a consultas
- **auditorias** — tabla existe, falta insertar registros de auditoria en cada operacion CRUD
- **reportes** — modulo de permisos existe, falta implementar generacion de reportes/impresion

## Migracion desde Access

El script `scripts/migrate_data.py` maneja:
- Parsing de nombres (Access guarda como "ApellidoP ApellidoM Nombre")
- Conversion de fechas con pivot de anio de 2 digitos
- Normalizacion de tipo de nacimiento (~30 variantes de typos)
- Splitting de tension arterial ("120/80" → sistolica/diastolica)
- Creacion de usuarios por defecto (admin + doctor) ya que Access no tenia tabla de usuarios
- Requiere `mdbtools` instalado en macOS (`brew install mdbtools`)

## Usuarios por defecto

| Correo | Contrasena | Rol |
|--------|------------|-----|
| admin@clinica.com | admin123 | admin |
| doctor@clinica.com | doctor123 | medico |

**IMPORTANTE:** Cambiar contrasenas en produccion. El hash actual es SHA256 simple.

## Notas de seguridad

- JWT secret hardcodeado en `auth.py` — cambiar para produccion
- Password hash usa SHA256 simple (no bcrypt) — considerar migrar a bcrypt
- CORS configurado para localhost:5173, localhost:3000, 127.0.0.1:5173
- El interceptor de Axios redirige a /login en cualquier 401
- No hay rate limiting implementado
