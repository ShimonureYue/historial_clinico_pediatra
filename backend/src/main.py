"""FastAPI application entry point."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


# ── Load .env before anything reads os.environ ────────────────────────────────
def _load_dotenv():
    """Parse .env file and inject into os.environ (won't overwrite existing vars)."""
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for name in [".env", "backup_config.env"]:  # .env preferred, fallback to old name
        path = os.path.join(project_root, name)
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, _, value = line.partition("=")
                        key, value = key.strip(), value.strip()
                        if key and key not in os.environ:
                            os.environ[key] = value
            break  # only load the first file found


_load_dotenv()

# ── Safe migrations for production DB ─────────────────────────────────────────
def _run_migrations():
    """Add new columns to existing tables without breaking production data."""
    from .database import get_db
    with get_db() as conn:
        # Check existing columns and add missing ones
        cols_consultas = {r["name"] for r in conn.execute("PRAGMA table_info(consultas)").fetchall()}
        if "notas_receta" not in cols_consultas:
            conn.execute("ALTER TABLE consultas ADD COLUMN notas_receta TEXT NULL")

        cols_trat = {r["name"] for r in conn.execute("PRAGMA table_info(tratamientos)").fetchall()}
        for col in ["medicamento", "indicaciones"]:
            if col not in cols_trat:
                conn.execute(f"ALTER TABLE tratamientos ADD COLUMN {col} TEXT NULL")

        # Relax NOT NULL on nombre_medicamento (SQLite requires table rebuild)
        col_info = conn.execute("PRAGMA table_info(tratamientos)").fetchall()
        nombre_col = next((c for c in col_info if c["name"] == "nombre_medicamento"), None)
        if nombre_col and nombre_col["notnull"]:
            conn.executescript("""
                CREATE TABLE tratamientos_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    consulta_id INTEGER NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
                    nombre_medicamento TEXT NULL,
                    presentacion TEXT NULL,
                    dosificacion TEXT NULL,
                    duracion TEXT NULL,
                    via_administracion TEXT NULL,
                    cantidad_surtir TEXT NULL,
                    medicamento TEXT NULL,
                    indicaciones TEXT NULL
                );
                INSERT INTO tratamientos_new SELECT id, consulta_id, nombre_medicamento,
                    presentacion, dosificacion, duracion, via_administracion, cantidad_surtir,
                    medicamento, indicaciones FROM tratamientos;
                DROP TABLE tratamientos;
                ALTER TABLE tratamientos_new RENAME TO tratamientos;
                CREATE INDEX IF NOT EXISTS idx_tratamientos_consulta ON tratamientos(consulta_id);
            """)

_run_migrations()

from .routers import auth_router, pacientes_router, consultas_router
from .routers import antecedentes_pp_router, antecedentes_pnp_router, antecedentes_hf_router
from .routers import usuarios_router, tratamientos_router, dashboard_router, respaldos_router

app = FastAPI(
    title="Historia Clínica Pediátrica API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api/auth", tags=["Auth"])
app.include_router(pacientes_router.router, prefix="/api/pacientes", tags=["Pacientes"])
app.include_router(consultas_router.router, prefix="/api/consultas", tags=["Consultas"])
app.include_router(antecedentes_pp_router.router, prefix="/api/antecedentes-patologicos", tags=["Antecedentes Patológicos"])
app.include_router(antecedentes_pnp_router.router, prefix="/api/antecedentes-no-patologicos", tags=["Antecedentes No Patológicos"])
app.include_router(antecedentes_hf_router.router, prefix="/api/antecedentes-heredo-familiares", tags=["Antecedentes Heredo Familiares"])
app.include_router(usuarios_router.router, prefix="/api/usuarios", tags=["Usuarios"])
app.include_router(tratamientos_router.router, prefix="/api/tratamientos", tags=["Tratamientos"])
app.include_router(dashboard_router.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(respaldos_router.router, prefix="/api/respaldos", tags=["Respaldos"])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ── Serve frontend static files in production ──
# When running from the packaged build, serve the frontend from the 'static' folder
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static")

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the SPA index.html for any non-API route."""
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
