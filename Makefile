# ============================================================
# Historia Clinica Pediatrica — Makefile
# ============================================================
# Atajos para desarrollo, base de datos, build y mantenimiento.
# Ejecuta `make` o `make help` para ver todos los targets.
#
# Variables sobreescribibles:
#   make backend PORT=9000          # cambia el puerto del backend
#   make migrate-access ACCESS=/ruta/base.mdb
# ============================================================

# --- Configuracion ---
PYTHON  ?= python3
VENV    := .venv
PY      := $(VENV)/bin/python
PIP     := $(VENV)/bin/pip
PORT    ?= 8000
ACCESS  ?=
FRONTEND := frontend

# Usa bash para los recipes multilinea (trap, &, wait)
SHELL := bash

.DEFAULT_GOAL := help

# ============================================================
# Ayuda
# ============================================================
.PHONY: help
help: ## Muestra esta ayuda
	@echo ""
	@echo "  Historia Clinica Pediatrica — targets disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN{FS=":.*?## "}{printf "    \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ============================================================
# Setup / dependencias
# ============================================================
.PHONY: setup
setup: ## Setup completo (venv + deps + base de datos + frontend) via setup.sh
	bash setup.sh

# Crea el venv e instala las dependencias del backend.
# Se regenera solo si .venv/bin/python no existe.
$(PY):
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -r backend/requirements.txt

.PHONY: venv
venv: $(PY) ## Crea el entorno virtual e instala dependencias del backend

# Instala dependencias de Node solo si falta node_modules.
$(FRONTEND)/node_modules: $(FRONTEND)/package.json
	cd $(FRONTEND) && npm install

.PHONY: install
install: venv $(FRONTEND)/node_modules ## Instala todas las dependencias (backend + frontend)

# ============================================================
# Base de datos
# ============================================================
.PHONY: db
db: venv ## Crea/actualiza el esquema de la base de datos (idempotente)
	$(PY) scripts/migrate_structure.py

.PHONY: seed
seed: venv ## Crea el esquema + datos de ejemplo (DB de desarrollo)
	$(PY) scripts/migrate_structure.py
	$(PY) scripts/migrate_data.py

.PHONY: migrate-access
migrate-access: venv ## Migra datos reales desde Access (uso: make migrate-access ACCESS=/ruta/base.mdb)
	@if [ -z "$(ACCESS)" ]; then \
		echo "ERROR: especifica la ruta del .mdb -> make migrate-access ACCESS=/ruta/base.mdb"; exit 1; \
	fi
	$(PY) scripts/migrate_structure.py
	$(PY) scripts/migrate_data.py --access "$(ACCESS)"

# ============================================================
# Desarrollo (servidores)
# ============================================================
.PHONY: backend
backend: venv ## Inicia el backend con auto-reload (FastAPI/uvicorn) en PORT
	$(PY) -m uvicorn backend.src.main:app --reload --port $(PORT)

.PHONY: frontend
frontend: $(FRONTEND)/node_modules ## Inicia el frontend en modo desarrollo (Vite, :5173)
	cd $(FRONTEND) && npm run dev

.PHONY: dev
dev: venv $(FRONTEND)/node_modules ## Levanta backend (:PORT) y frontend (:5173) juntos
	@echo "Backend  -> http://localhost:$(PORT)"
	@echo "Frontend -> http://localhost:5173"
	@echo "Ctrl-C para detener ambos."
	@trap 'kill 0' INT TERM; \
		$(PY) -m uvicorn backend.src.main:app --reload --port $(PORT) & \
		( cd $(FRONTEND) && npm run dev ) & \
		wait

.PHONY: serve
serve: venv ## Inicia el backend en modo produccion (sin reload) en PORT
	$(PY) -m uvicorn backend.src.main:app --host 0.0.0.0 --port $(PORT)

# ============================================================
# Build / empaquetado
# ============================================================
.PHONY: build-frontend
build-frontend: $(FRONTEND)/node_modules ## Compila el frontend de produccion (dist/)
	cd $(FRONTEND) && npm run build

.PHONY: package
package: venv $(FRONTEND)/node_modules ## Empaqueta todo para Windows (build/HistorialPediatrico/)
	$(PY) scripts/build_package.py

.PHONY: build-update
build-update: venv $(FRONTEND)/node_modules ## Genera el paquete de actualizacion ligero (build/update/, sin DB)
	$(PY) scripts/build_update.py

# ============================================================
# Calidad / verificacion
# ============================================================
.PHONY: lint
lint: $(FRONTEND)/node_modules ## Ejecuta ESLint sobre el frontend
	cd $(FRONTEND) && npm run lint

.PHONY: check
check: venv ## Verifica que el backend y los scripts compilan (py_compile)
	$(PY) -m py_compile backend/src/*.py backend/src/routers/*.py scripts/*.py
	@echo "OK: backend y scripts compilan sin errores de sintaxis"

# ============================================================
# Limpieza
# ============================================================
.PHONY: clean
clean: ## Borra caches de Python y el build del frontend
	find . -type d -name __pycache__ -not -path "./.venv/*" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.py[cod]" -not -path "./.venv/*" -delete 2>/dev/null || true
	rm -rf $(FRONTEND)/dist
	rm -rf build/HistorialPediatrico
	@echo "Limpieza completada."

.PHONY: clean-venv
clean-venv: ## Elimina el entorno virtual de Python
	rm -rf $(VENV)
	@echo "Entorno virtual eliminado."

.PHONY: clean-all
clean-all: clean clean-venv ## Limpieza total (caches + venv + node_modules)
	rm -rf $(FRONTEND)/node_modules
	@echo "Limpieza total completada."
