#!/usr/bin/env bash
# setup.sh — Configura el entorno de desarrollo en cualquier maquina (macOS/Linux)
# Uso: bash setup.sh
set -e

cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"

echo "================================================"
echo " Historia Clinica Pediatrica — Setup"
echo " Directorio: $PROJECT_ROOT"
echo "================================================"
echo

# ── 1. Buscar Python 3.14+ ──────────────────────────────
find_python() {
    # Prioridad: pyenv local → python3.14 → python3 → python
    if command -v pyenv &>/dev/null; then
        local pyenv_ver
        pyenv_ver="$(pyenv version-name 2>/dev/null || true)"
        if [[ "$pyenv_ver" == 3.14* ]]; then
            echo "$(pyenv which python3 2>/dev/null || pyenv which python 2>/dev/null)"
            return
        fi
    fi
    for cmd in python3.14 python3 python; do
        if command -v "$cmd" &>/dev/null; then
            local ver
            ver="$("$cmd" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')"
            local major="${ver%%.*}"
            local minor="${ver#*.}"
            if [[ "$major" -eq 3 && "$minor" -ge 14 ]]; then
                command -v "$cmd"
                return
            fi
        fi
    done
    return 1
}

PYTHON_BIN="$(find_python)" || {
    echo "ERROR: No se encontro Python 3.14+"
    echo "  Instala con pyenv:  pyenv install 3.14"
    echo "  O descarga desde:   https://www.python.org/downloads/"
    exit 1
}

echo "[1/5] Python encontrado: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"

# ── 2. Crear/recrear venv ────────────────────────────────
if [ -d ".venv" ]; then
    # Verificar si el venv actual apunta a un Python valido
    if ! .venv/bin/python3 --version &>/dev/null 2>&1; then
        echo "  .venv roto (Python no encontrado), recreando..."
        rm -rf .venv
    else
        VENV_PY="$(.venv/bin/python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')"
        if [[ "$VENV_PY" != "3.14" ]]; then
            echo "  .venv tiene Python $VENV_PY, recreando para 3.14..."
            rm -rf .venv
        else
            echo "  .venv existe y es valido (Python $VENV_PY)"
        fi
    fi
fi

if [ ! -d ".venv" ]; then
    echo "[2/5] Creando entorno virtual..."
    "$PYTHON_BIN" -m venv .venv
else
    echo "[2/5] Entorno virtual existente OK"
fi

# ── 3. Instalar dependencias Python ──────────────────────
echo "[3/5] Instalando dependencias Python..."
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r backend/requirements.txt -q

echo "[4/5] Verificando base de datos..."
DB_FILE="database/historial_pediatrico.db"
if [ ! -f "$DB_FILE" ]; then
    echo "  Base de datos no encontrada."
    mkdir -p database
    echo "  Creando estructura de tablas..."
    .venv/bin/python scripts/migrate_structure.py
    echo "  Creando datos de ejemplo (5 pacientes, 1 consulta, 2 usuarios)..."
    .venv/bin/python scripts/migrate_data.py
    echo "  Base de datos lista: $DB_FILE"
    echo
    echo "  Para migrar datos reales desde Access en su lugar:"
    echo "    rm database/historial_pediatrico.db"
    echo "    source .venv/bin/activate"
    echo "    python scripts/migrate_structure.py"
    echo "    python scripts/migrate_data.py --access /ruta/a/base.mdb"
    echo
else
    echo "  Base de datos encontrada: $DB_FILE"
fi

echo "[5/5] Configurando frontend..."

# Crear frontend/.env si no existe
if [ ! -f "frontend/.env" ]; then
    echo "VITE_API_PORT=8000" > frontend/.env
    echo "  frontend/.env creado (VITE_API_PORT=8000)"
fi

# Instalar deps de Node si nvm esta disponible
if [ -d "frontend/node_modules" ]; then
    echo "  node_modules ya existe"
elif command -v node &>/dev/null; then
    echo "  Instalando dependencias npm..."
    (cd frontend && npm install --silent 2>/dev/null) || echo "  AVISO: npm install fallo. Ejecuta manualmente: cd frontend && npm install"
else
    echo "  AVISO: Node.js no encontrado. Para el frontend ejecuta:"
    echo "    source ~/.nvm/nvm.sh && nvm use 20"
    echo "    cd frontend && npm install"
fi

echo
echo "================================================"
echo " Setup completado!"
echo "================================================"
echo
echo "Para iniciar el backend:"
echo "  source .venv/bin/activate"
echo "  uvicorn backend.src.main:app --reload --port 8000"
echo
echo "Para iniciar el frontend (en otra terminal):"
echo "  cd frontend && npm run dev"
echo
