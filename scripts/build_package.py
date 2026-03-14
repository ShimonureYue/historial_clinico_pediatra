"""
build_package.py
================
Empaqueta el proyecto (frontend compilado + backend + base de datos SQLite)
en una carpeta 'build/HistorialPediatrico/' lista para copiar a Windows 10.

FLUJO:
    1. En macOS: migrar Access -> SQLite (migrate_structure.py + migrate_data.py)
    2. En macOS: ejecutar este script para empaquetar todo
    3. Copiar build/HistorialPediatrico/ a la PC con Windows 10
    4. En Windows: setup.bat -> run.bat

Requisitos (macOS):
    - Node.js 20 (via nvm) para compilar el frontend
    - .venv activado con dependencias instaladas

Uso:
    source .venv/bin/activate
    source ~/.nvm/nvm.sh && nvm use 20
    python scripts/build_package.py
"""

import os
import shutil
import subprocess
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(PROJECT_ROOT, "build", "HistorialPediatrico")
DB_FILE = os.path.join(PROJECT_ROOT, "database", "historial_pediatrico.db")


def clean_build():
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR, exist_ok=True)
    print("[1/6] Carpeta build limpiada")


def build_frontend():
    frontend_dir = os.path.join(PROJECT_ROOT, "frontend")
    print("[2/6] Compilando frontend...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=frontend_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Error compilando frontend:\n{result.stderr}")
        sys.exit(1)

    dist_dir = os.path.join(frontend_dir, "dist")
    static_dir = os.path.join(BUILD_DIR, "static")
    shutil.copytree(dist_dir, static_dir)
    print(f"  Frontend compilado -> static/")


def copy_backend():
    print("[3/6] Copiando backend...")
    src = os.path.join(PROJECT_ROOT, "backend", "src")
    dst = os.path.join(BUILD_DIR, "backend", "src")
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    # Also create backend/__init__.py if needed
    init_path = os.path.join(BUILD_DIR, "backend", "__init__.py")
    if not os.path.exists(init_path):
        with open(init_path, "w") as f:
            pass

    shutil.copy2(
        os.path.join(PROJECT_ROOT, "backend", "requirements.txt"),
        os.path.join(BUILD_DIR, "requirements.txt"),
    )
    print("  Backend copiado")


def copy_database():
    """Copy the already-migrated SQLite database."""
    print("[4/6] Copiando base de datos SQLite...")
    db_dir = os.path.join(BUILD_DIR, "database")
    os.makedirs(db_dir, exist_ok=True)
    os.makedirs(os.path.join(db_dir, "backups"), exist_ok=True)

    if os.path.exists(DB_FILE):
        shutil.copy2(DB_FILE, os.path.join(db_dir, "historial_pediatrico.db"))
        size_kb = os.path.getsize(DB_FILE) / 1024
        print(f"  Base de datos copiada ({size_kb:.0f} KB)")
    else:
        print("  ADVERTENCIA: No se encontró la base de datos.")
        print(f"  Ejecuta primero la migración:")
        print(f"    python scripts/migrate_structure.py")
        print(f"    python scripts/migrate_data.py --access tu_archivo.mdb")
        sys.exit(1)


def copy_migration_scripts():
    """Copy migration scripts in case they need to re-run on Windows."""
    print("[5/6] Copiando scripts de migración (respaldo)...")
    scripts_dst = os.path.join(BUILD_DIR, "scripts")
    os.makedirs(scripts_dst, exist_ok=True)
    for fname in ["migrate_structure.py", "migrate_data.py"]:
        src_file = os.path.join(PROJECT_ROOT, "scripts", fname)
        if os.path.exists(src_file):
            shutil.copy2(src_file, os.path.join(scripts_dst, fname))
    print("  Scripts copiados")


def create_windows_scripts():
    print("[6/6] Creando scripts de Windows...")

    # ── setup.bat ──
    setup_bat = r"""@echo off
chcp 65001 >nul
echo ============================================
echo  Historia Clinica Pediatrica - Instalacion
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado.
    echo Descarga Python 3.10+ desde https://www.python.org/downloads/
    echo IMPORTANTE: Marca "Add Python to PATH" durante la instalacion.
    pause
    exit /b 1
)

echo Python encontrado:
python --version
echo.

echo Creando entorno virtual...
python -m venv .venv
if errorlevel 1 (
    echo ERROR: No se pudo crear el entorno virtual.
    pause
    exit /b 1
)

echo Activando entorno e instalando dependencias...
call .venv\Scripts\activate.bat
pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Instalacion completada exitosamente!
echo ============================================
echo.
echo Ahora ejecuta: run.bat
echo.
pause
"""

    # ── run.bat ──
    run_bat = r"""@echo off
chcp 65001 >nul
echo ============================================
echo  Historia Clinica Pediatrica
echo ============================================
echo.

:: Check venv exists
if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: No se encontro el entorno virtual.
    echo Ejecuta primero: setup.bat
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat

:: Check database
if not exist "database\historial_pediatrico.db" (
    echo ERROR: No se encontro la base de datos.
    echo El archivo database\historial_pediatrico.db no existe.
    echo Asegurate de que la carpeta se copio completa.
    pause
    exit /b 1
)

echo Iniciando servidor...
echo.
echo ========================================
echo  Abre tu navegador en:
echo  http://localhost:8000
echo ========================================
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.

start "" "http://localhost:8000"
python -m uvicorn backend.src.main:app --host 127.0.0.1 --port 8000
pause
"""

    # ── README.txt ──
    readme_txt = r"""============================================================
  HISTORIA CLINICA PEDIATRICA
  Guia de Instalacion y Uso - Windows 10
============================================================

Este programa funciona en tu navegador (Chrome, Edge, Firefox).
Solo necesitas instalar Python una vez y luego ya puedes usarlo.

NO necesitas instalar nada mas (no necesitas Node.js ni nada
adicional). Solo Python.


============================================================
  PASO 1: INSTALAR PYTHON (solo la primera vez)
============================================================

  1. Abre tu navegador y ve a esta pagina:

     https://www.python.org/downloads/

  2. Haz clic en el boton amarillo grande que dice
     "Download Python 3.1x.x" (el numero puede variar).

  3. Se descargara un archivo como "python-3.12.x-amd64.exe".
     Buscalo en tu carpeta de Descargas y haz DOBLE CLIC
     para abrirlo.

  4. MUY IMPORTANTE - En la primera pantalla del instalador:

     [x] Marca la casilla que dice:
         "Add Python to PATH"  (o "Add python.exe to PATH")

         Esta casilla esta ABAJO del todo, asegurate de
         marcarla ANTES de hacer clic en instalar.

  5. Haz clic en "Install Now" (Instalar ahora).

  6. Espera a que termine. Cuando diga "Setup was successful",
     haz clic en "Close" (Cerrar).

  7. Listo! Python quedo instalado.

  NOTA: Si ya tienes Python 3.10 o superior instalado,
  puedes saltarte este paso.


============================================================
  PASO 2: CONFIGURAR EL PROGRAMA (solo la primera vez)
============================================================

  1. Abre la carpeta "HistorialPediatrico" (esta carpeta).

  2. Busca el archivo "setup.bat" y haz DOBLE CLIC en el.

  3. Se abrira una ventana negra (consola). Espera a que
     termine de instalar todo. Puede tardar 1-2 minutos.
     Veras mensajes de progreso.

  4. Al final veras:
     "Instalacion completada exitosamente!"

  5. Presiona cualquier tecla para cerrar esa ventana.

  NOTA: Si ves un error de que "Python no esta instalado",
  regresa al Paso 1 y asegurate de marcar "Add Python to PATH".
  Si ya lo instalaste sin esa opcion, desinstala Python desde
  Panel de Control > Programas, y vuelve a instalarlo marcando
  la casilla.


============================================================
  PASO 3: USAR EL PROGRAMA (cada vez que quieras usarlo)
============================================================

  1. Abre la carpeta "HistorialPediatrico".

  2. Haz DOBLE CLIC en "run.bat".

  3. Se abrira una ventana negra y automaticamente se abrira
     tu navegador en la pagina del sistema.

     Si no se abre solo, abre tu navegador (Chrome, Edge o
     Firefox) y escribe en la barra de direcciones:
     http://localhost:8000

  4. Inicia sesion con estas credenciales:

     Correo:     admin@clinica.com
     Contrasena: admin123

     (o bien)

     Correo:     doctor@clinica.com
     Contrasena: doctor123

  5. Ya puedes usar el sistema!


============================================================
  COMO CERRAR EL PROGRAMA
============================================================

  Cuando termines de usar el sistema:

  1. Cierra la pestana del navegador normalmente.

  2. Ve a la ventana negra (consola) que quedo abierta
     y ciérrala con la X, o presiona Ctrl+C.

  IMPORTANTE: Mientras la ventana negra este abierta, el
  sistema esta funcionando. Si la cierras, el sistema se
  detiene (esto es normal).


============================================================
  COMO RESPALDAR LA BASE DE DATOS
============================================================

  Los datos de los pacientes se guardan en un solo archivo:

    database\historial_pediatrico.db

  Para hacer un respaldo:
  1. Asegurate de que el programa NO este corriendo
     (la ventana negra debe estar cerrada).
  2. Copia el archivo "historial_pediatrico.db" a una
     USB, otro disco o carpeta segura.

  Para restaurar un respaldo:
  1. Asegurate de que el programa NO este corriendo.
  2. Reemplaza el archivo "historial_pediatrico.db" con
     tu copia de respaldo.


============================================================
  PROBLEMAS COMUNES
============================================================

  "Python no esta instalado"
  → Instala Python como se explica en el Paso 1.
     Asegurate de marcar "Add Python to PATH".

  "No se encontro el entorno virtual"
  → Ejecuta setup.bat primero (Paso 2).

  "No se encontro la base de datos"
  → Verifica que la carpeta "database" contenga el archivo
    "historial_pediatrico.db". Si se borro por accidente,
    restaura desde un respaldo.

  "El navegador dice que no puede conectar"
  → Verifica que la ventana negra este abierta y no muestre
    errores. Si hay error, ciérrala y vuelve a abrir run.bat.

  "El puerto ya esta en uso"
  → Otro programa esta usando el puerto 8000. Cierra ese
    programa o reinicia la computadora e intenta de nuevo.

  "Windows Defender bloquea el programa"
  → Es normal. Haz clic en "Mas informacion" y luego en
    "Ejecutar de todas formas". El programa es seguro.


============================================================
  ARCHIVOS DE ESTA CARPETA
============================================================

  setup.bat          → Configura el programa (solo 1 vez)
  run.bat            → Inicia el sistema (cada vez)
  README.txt         → Esta guia que estas leyendo
  requirements.txt   → Lista de componentes de Python
  database\          → Base de datos con la informacion
  backend\           → Motor del sistema
  static\            → Interfaz visual del sistema
  scripts\           → Herramientas de migracion (respaldo)
"""

    for name, content in [
        ("setup.bat", setup_bat),
        ("run.bat", run_bat),
        ("README.txt", readme_txt),
    ]:
        path = os.path.join(BUILD_DIR, name)
        with open(path, "w", encoding="utf-8", newline="\r\n") as f:
            f.write(content)
        print(f"  {name} creado")


def main():
    print("=" * 50)
    print(" Empaquetando Historia Clínica Pediátrica")
    print("=" * 50)
    print()

    clean_build()
    build_frontend()
    copy_backend()
    copy_database()
    copy_migration_scripts()
    create_windows_scripts()

    # Calculate total size
    total_size = 0
    for dirpath, _, filenames in os.walk(BUILD_DIR):
        for f in filenames:
            total_size += os.path.getsize(os.path.join(dirpath, f))
    size_mb = total_size / (1024 * 1024)

    print()
    print("=" * 50)
    print(f" Empaquetado completado!")
    print(f" Ubicación: build/HistorialPediatrico/")
    print(f" Tamaño: {size_mb:.1f} MB")
    print("=" * 50)
    print()
    print("Para desplegar en Windows:")
    print("  1. Copia la carpeta 'build/HistorialPediatrico/' al equipo")
    print("  2. Haz doble clic en setup.bat (solo la primera vez)")
    print("  3. Haz doble clic en run.bat para iniciar")


if __name__ == "__main__":
    main()
