"""
build_package_win8.py
=====================
Empaqueta el proyecto para Windows 8 (requiere Python 3.8.x).

La diferencia con build_package.py es:
  - requirements.txt usa versiones compatibles con Python 3.8
  - setup.bat indica Python 3.8
  - README.txt indica Windows 8
  - Se genera en build/HistorialPediatrico_Win8/

Uso:
    source .venv/bin/activate
    source ~/.nvm/nvm.sh && nvm use 20
    python scripts/build_package_win8.py
"""

import os
import shutil
import subprocess
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(PROJECT_ROOT, "build", "HistorialPediatrico_Win8")
DB_FILE = os.path.join(PROJECT_ROOT, "database", "historial_pediatrico.db")

# Python 3.8-compatible versions
REQUIREMENTS_WIN8 = """\
fastapi==0.124.0
uvicorn==0.33.0
python-jose[cryptography]==3.4.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.20
"""


def clean_build():
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR, exist_ok=True)
    print("[1/6] Carpeta build limpiada")


def build_frontend():
    frontend_dir = os.path.join(PROJECT_ROOT, "frontend")
    dist_dir = os.path.join(frontend_dir, "dist")

    # Reuse existing dist if available (avoid rebuilding)
    if not os.path.isdir(dist_dir):
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
    else:
        print("[2/6] Reutilizando frontend compilado (dist/ existente)")

    static_dir = os.path.join(BUILD_DIR, "static")
    shutil.copytree(dist_dir, static_dir)
    print("  Frontend -> static/")


def copy_backend():
    print("[3/6] Copiando backend...")
    src = os.path.join(PROJECT_ROOT, "backend", "src")
    dst = os.path.join(BUILD_DIR, "backend", "src")
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    init_path = os.path.join(BUILD_DIR, "backend", "__init__.py")
    if not os.path.exists(init_path):
        with open(init_path, "w") as f:
            pass

    # Write Python 3.8-compatible requirements
    req_path = os.path.join(BUILD_DIR, "requirements.txt")
    with open(req_path, "w") as f:
        f.write(REQUIREMENTS_WIN8)
    print("  Backend copiado (requirements para Python 3.8)")


def copy_database():
    print("[4/6] Copiando base de datos SQLite...")
    db_dir = os.path.join(BUILD_DIR, "database")
    os.makedirs(db_dir, exist_ok=True)
    os.makedirs(os.path.join(db_dir, "backups"), exist_ok=True)

    if os.path.exists(DB_FILE):
        shutil.copy2(DB_FILE, os.path.join(db_dir, "historial_pediatrico.db"))
        size_kb = os.path.getsize(DB_FILE) / 1024
        print(f"  Base de datos copiada ({size_kb:.0f} KB)")
    else:
        print("  ADVERTENCIA: No se encontro la base de datos.")
        print("  Ejecuta primero la migracion:")
        print("    python scripts/migrate_structure.py")
        print("    python scripts/migrate_data.py --access tu_archivo.mdb")
        sys.exit(1)


def copy_migration_scripts():
    print("[5/6] Copiando scripts de migracion (respaldo)...")
    scripts_dst = os.path.join(BUILD_DIR, "scripts")
    os.makedirs(scripts_dst, exist_ok=True)
    for fname in ["migrate_structure.py", "migrate_data.py"]:
        src_file = os.path.join(PROJECT_ROOT, "scripts", fname)
        if os.path.exists(src_file):
            shutil.copy2(src_file, os.path.join(scripts_dst, fname))
    print("  Scripts copiados")


def create_windows_scripts():
    print("[6/6] Creando scripts de Windows 8...")

    setup_bat = r"""@echo off
chcp 65001 >nul
echo ============================================
echo  Historia Clinica Pediatrica - Instalacion
echo  (Windows 8 - Python 3.8)
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado.
    echo Descarga Python 3.8.20 desde:
    echo   https://www.python.org/downloads/release/python-3820/
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

    readme_txt = r"""============================================================
  HISTORIA CLINICA PEDIATRICA
  Guia de Instalacion y Uso - Windows 8
============================================================

Este programa funciona en tu navegador (Chrome, Edge, Firefox).
Solo necesitas instalar Python una vez y luego ya puedes usarlo.

NO necesitas instalar nada mas (no necesitas Node.js ni nada
adicional). Solo Python.

IMPORTANTE PARA WINDOWS 8:
  Debes instalar Python 3.8 (NO una version mas nueva).
  Las versiones 3.9, 3.10, 3.11, 3.12, etc. NO funcionan
  en Windows 8. Solo la version 3.8.


============================================================
  PASO 1: INSTALAR PYTHON 3.8 (solo la primera vez)
============================================================

  1. Abre tu navegador y ve a esta pagina:

     https://www.python.org/downloads/release/python-3820/

  2. Baja hasta la seccion "Files" (archivos) y busca:

     "Windows installer (64-bit)"
     → Si tu computadora es de 64 bits (la mayoria lo son)

     "Windows installer (32-bit)"
     → Si tu computadora es de 32 bits (mas antigua)

     Si no sabes cual es:
     - Haz clic derecho en "Equipo" o "Mi PC" en el escritorio
     - Selecciona "Propiedades"
     - Busca donde dice "Tipo de sistema"
     - Ahi dira "64 bits" o "32 bits"

  3. Haz clic en el enlace para descargar el instalador.

  4. Busca el archivo descargado (probablemente en tu carpeta
     de Descargas) y haz DOBLE CLIC para abrirlo.

  5. MUY IMPORTANTE - En la primera pantalla del instalador:

     [x] Marca la casilla que dice:
         "Add Python 3.8 to PATH"

         Esta casilla esta ABAJO del todo, asegurate de
         marcarla ANTES de hacer clic en instalar.

  6. Haz clic en "Install Now" (Instalar ahora).

  7. Si Windows pregunta "Desea permitir que esta aplicacion
     haga cambios?", haz clic en "Si".

  8. Espera a que termine. Cuando diga "Setup was successful",
     haz clic en "Close" (Cerrar).

  9. Listo! Python quedo instalado.


============================================================
  PASO 2: CONFIGURAR EL PROGRAMA (solo la primera vez)
============================================================

  1. Abre la carpeta "HistorialPediatrico_Win8" (esta carpeta).

  2. Busca el archivo "setup.bat" y haz DOBLE CLIC en el.

     Si Windows muestra un aviso de seguridad:
     → Haz clic en "Mas informacion"
     → Luego en "Ejecutar de todas formas"
     (El programa es seguro, Windows avisa porque no tiene
      firma digital.)

  3. Se abrira una ventana negra (consola). Espera a que
     termine de instalar todo. Puede tardar 1-3 minutos.
     Veras mensajes de progreso.

  4. Al final veras:
     "Instalacion completada exitosamente!"

  5. Presiona cualquier tecla para cerrar esa ventana.

  NOTA: Si ves un error de que "Python no esta instalado",
  regresa al Paso 1 y asegurate de:
  - Haber instalado Python 3.8 (no otra version)
  - Haber marcado "Add Python 3.8 to PATH"
  Si ya lo instalaste sin esa opcion, desinstala Python desde
  Panel de Control > Programas, y vuelve a instalarlo marcando
  la casilla.


============================================================
  PASO 3: USAR EL PROGRAMA (cada vez que quieras usarlo)
============================================================

  1. Abre la carpeta "HistorialPediatrico_Win8".

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
     y cierrala con la X, o presiona Ctrl+C.

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
  → Instala Python 3.8 como se explica en el Paso 1.
    Asegurate de marcar "Add Python 3.8 to PATH".
    IMPORTANTE: No instales Python 3.9 o superior, ya que
    no funciona en Windows 8.

  "No se encontro el entorno virtual"
  → Ejecuta setup.bat primero (Paso 2).

  "No se encontro la base de datos"
  → Verifica que la carpeta "database" contenga el archivo
    "historial_pediatrico.db". Si se borro por accidente,
    restaura desde un respaldo.

  "El navegador dice que no puede conectar"
  → Verifica que la ventana negra este abierta y no muestre
    errores. Si hay error, cierrala y vuelve a abrir run.bat.

  "El puerto ya esta en uso"
  → Otro programa esta usando el puerto 8000. Cierra ese
    programa o reinicia la computadora e intenta de nuevo.

  "Windows Defender o antivirus bloquea el programa"
  → Es normal. Haz clic en "Mas informacion" y luego en
    "Ejecutar de todas formas". El programa es seguro.


============================================================
  NOTA TECNICA
============================================================

  Esta version usa dependencias compatibles con Python 3.8
  (la ultima version de Python que funciona en Windows 8):
    - FastAPI 0.124.0
    - Uvicorn 0.33.0
  La funcionalidad del sistema es identica a la version
  de Windows 10.


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
    print(" Empaquetando para Windows 8 (Python 3.8)")
    print("=" * 50)
    print()

    clean_build()
    build_frontend()
    copy_backend()
    copy_database()
    copy_migration_scripts()
    create_windows_scripts()

    total_size = 0
    for dirpath, _, filenames in os.walk(BUILD_DIR):
        for f in filenames:
            total_size += os.path.getsize(os.path.join(dirpath, f))
    size_mb = total_size / (1024 * 1024)

    print()
    print("=" * 50)
    print(f" Empaquetado completado!")
    print(f" Ubicacion: build/HistorialPediatrico_Win8/")
    print(f" Tamano: {size_mb:.1f} MB")
    print("=" * 50)
    print()
    print("Para desplegar en Windows 8:")
    print("  1. Instalar Python 3.8.20 (NO 3.9+)")
    print("     https://www.python.org/downloads/release/python-3820/")
    print("  2. Copiar la carpeta 'build/HistorialPediatrico_Win8/' al equipo")
    print("  3. Doble clic en setup.bat (solo la primera vez)")
    print("  4. Doble clic en run.bat para iniciar")


if __name__ == "__main__":
    main()
