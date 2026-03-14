"""FastAPI application entry point."""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .routers import auth_router, pacientes_router, consultas_router
from .routers import antecedentes_pp_router, antecedentes_pnp_router, antecedentes_hf_router
from .routers import usuarios_router, tratamientos_router

app = FastAPI(
    title="Historia Clínica Pediátrica API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
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
