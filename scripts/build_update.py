"""
build_update.py
===============
Genera un paquete de ACTUALIZACION ligero (sin base de datos).
Solo incluye backend + frontend compilado + requirements.txt + update.bat.

El usuario copia la carpeta generada al equipo Windows y ejecuta update.bat.
El script actualiza el sistema sin tocar la base de datos.

Uso:
    source .venv/bin/activate
    source ~/.nvm/nvm.sh && nvm use 20
    python scripts/build_update.py
"""

import os
import shutil
import subprocess
import sys
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPDATE_DIR = os.path.join(PROJECT_ROOT, "build", "update")


def clean():
    if os.path.exists(UPDATE_DIR):
        shutil.rmtree(UPDATE_DIR)
    os.makedirs(UPDATE_DIR, exist_ok=True)
    print("[1/4] Carpeta update limpiada")


def build_frontend():
    frontend_dir = os.path.join(PROJECT_ROOT, "frontend")
    print("[2/4] Compilando frontend...")
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
    static_dir = os.path.join(UPDATE_DIR, "static")
    shutil.copytree(dist_dir, static_dir)
    print("  Frontend compilado -> static/")


def copy_backend():
    print("[3/4] Copiando backend...")
    src = os.path.join(PROJECT_ROOT, "backend", "src")
    dst = os.path.join(UPDATE_DIR, "backend", "src")
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    init_path = os.path.join(UPDATE_DIR, "backend", "__init__.py")
    if not os.path.exists(init_path):
        with open(init_path, "w") as f:
            pass

    shutil.copy2(
        os.path.join(PROJECT_ROOT, "backend", "requirements.txt"),
        os.path.join(UPDATE_DIR, "requirements.txt"),
    )
    print("  Backend copiado")

    # Copy .env.example and config guide
    for fname in [".env.example", "CONFIGURACION_ENV.txt"]:
        src_file = os.path.join(PROJECT_ROOT, fname)
        if os.path.exists(src_file):
            shutil.copy2(src_file, os.path.join(UPDATE_DIR, fname))
            print(f"  {fname} copiado")


def create_update_bat():
    print("[4/4] Creando update.bat...")

    update_bat = r"""@echo off
chcp 65001 >nul
echo ============================================
echo  Historia Clinica Pediatrica - Actualizacion
echo ============================================
echo.

:: Pedir ruta de instalacion
echo Escribe la ruta donde esta instalado el sistema.
echo Ejemplo: C:\HistorialPediatrico
echo.
set /p INSTALL_DIR=Ruta de instalacion:

:: Quitar comillas si las puso
set INSTALL_DIR=%INSTALL_DIR:"=%

:: Quitar barra final si la tiene
if "%INSTALL_DIR:~-1%"=="\" set INSTALL_DIR=%INSTALL_DIR:~0,-1%

:: Validar que exista la base de datos
if not exist "%INSTALL_DIR%\database\historial_pediatrico.db" (
    echo.
    echo ERROR: No se encontro la instalacion en:
    echo   %INSTALL_DIR%
    echo.
    echo Verifica que la ruta sea correcta y que contenga
    echo la carpeta "database" con "historial_pediatrico.db".
    echo.
    pause
    exit /b 1
)

echo.
echo Instalacion encontrada en: %INSTALL_DIR%
echo.

set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo [1/4] Verificando que el sistema NO este corriendo...
echo   Si la ventana negra del servidor esta abierta, CIERRA LA primero.
echo.
pause

echo [2/4] Respaldando base de datos...
if not exist "%INSTALL_DIR%\database\backups" mkdir "%INSTALL_DIR%\database\backups"
copy "%INSTALL_DIR%\database\historial_pediatrico.db" "%INSTALL_DIR%\database\backups\historial_pediatrico_%TIMESTAMP%.db" >nul
if errorlevel 1 (
    echo ERROR: No se pudo respaldar la base de datos.
    echo Asegurate de que el sistema NO este corriendo.
    pause
    exit /b 1
)
echo   Respaldo creado: %INSTALL_DIR%\database\backups\historial_pediatrico_%TIMESTAMP%.db

echo [3/4] Actualizando archivos...

:: Eliminar backend viejo y copiar nuevo
if exist "%INSTALL_DIR%\backend" rmdir /s /q "%INSTALL_DIR%\backend"
xcopy "backend" "%INSTALL_DIR%\backend" /e /i /q >nul
echo   backend\ actualizado

:: Eliminar static viejo y copiar nuevo
if exist "%INSTALL_DIR%\static" rmdir /s /q "%INSTALL_DIR%\static"
xcopy "static" "%INSTALL_DIR%\static" /e /i /q >nul
echo   static\ actualizado

:: Copiar requirements
copy "requirements.txt" "%INSTALL_DIR%\requirements.txt" /y >nul
echo   requirements.txt actualizado

echo [4/4] Instalando dependencias nuevas...
cd /d "%INSTALL_DIR%"
call .venv\Scripts\activate.bat
pip install -r requirements.txt -q
echo   Dependencias actualizadas

:: Copiar guia de configuracion y .env.example siempre
if exist "CONFIGURACION_ENV.txt" copy "CONFIGURACION_ENV.txt" "%INSTALL_DIR%\CONFIGURACION_ENV.txt" /y >nul
if exist ".env.example" copy ".env.example" "%INSTALL_DIR%\.env.example" /y >nul

:: Verificar .env
if not exist "%INSTALL_DIR%\.env" (
    echo.
    echo ============================================
    echo  NOTA: Archivo .env no encontrado
    echo ============================================
    echo  Copia .env.example como .env y edita los valores:
    echo    copy "%INSTALL_DIR%\.env.example" "%INSTALL_DIR%\.env"
    echo.
    echo  Consulta CONFIGURACION_ENV.txt para mas detalles.
) else (
    :: Revisar si .env tiene las variables de S3 (nuevas)
    findstr /c:"AWS_ACCESS_KEY_ID" "%INSTALL_DIR%\.env" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo ============================================
        echo  NOTA: Nuevas variables disponibles
        echo ============================================
        echo  Tu .env no tiene las variables de respaldos a S3.
        echo  Si quieres usar respaldos a la nube, agrega las
        echo  variables de AWS a tu .env
        echo.
        echo  Consulta .env.example o CONFIGURACION_ENV.txt
        echo  para ver las variables nuevas.
    )
)

echo.
echo ============================================
echo  Actualizacion completada!
echo ============================================
echo.
echo La base de datos NO fue modificada.
echo Respaldo en: %INSTALL_DIR%\database\backups\historial_pediatrico_%TIMESTAMP%.db
echo.
echo Ve a %INSTALL_DIR% y ejecuta run.bat para iniciar.
echo.
pause
"""

    path = os.path.join(UPDATE_DIR, "update.bat")
    with open(path, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(update_bat)
    print("  update.bat creado")


def main():
    print("=" * 50)
    print(" Generando paquete de actualización")
    print("=" * 50)
    print()

    clean()
    build_frontend()
    copy_backend()
    create_update_bat()

    # Calcular tamaño
    total_size = 0
    for dirpath, _, filenames in os.walk(UPDATE_DIR):
        for f in filenames:
            total_size += os.path.getsize(os.path.join(dirpath, f))
    size_mb = total_size / (1024 * 1024)

    print()
    print("=" * 50)
    print(f" Paquete de actualización generado!")
    print(f" Ubicación: build/update/")
    print(f" Tamaño: {size_mb:.1f} MB")
    print("=" * 50)
    print()
    print("Contenido:")
    print("  update.bat        → Script de actualización")
    print("  backend/          → Código Python actualizado")
    print("  static/           → Frontend compilado")
    print("  requirements.txt  → Dependencias Python")
    print()
    print("NO incluye: database/ (la base de datos no se toca)")
    print()
    print("Para actualizar en Windows:")
    print("  1. Copia la carpeta 'build/update/' a la PC (USB, red, etc.)")
    print("  2. Cierra el sistema si está corriendo")
    print("  3. Ejecuta update.bat (te pedirá la ruta de instalación)")


if __name__ == "__main__":
    main()
