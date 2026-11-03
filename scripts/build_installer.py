"""
build_installer.py
==================
Genera el instalador de Windows: build/HistorialPediatrico-Setup-<version>.exe

El instalador deja Historia Clinica Pediatrica como programa de escritorio:
icono en el escritorio y en el menu Inicio, ventana propia (sin navegador) y
Python 3.14 incluido, asi que en la PC de la clinica no hay que instalar nada
mas ni se necesita internet.

No incluye la base de datos: la primera vez que se abre en un equipo pide el
respaldo .db (de S3 o USB). Para actualizar basta con correr un Setup nuevo;
los datos (en %LOCALAPPDATA%\\HistorialPediatrico) no se tocan.

Requisitos (macOS):
    brew install makensis
    Node.js 20+ para compilar el frontend
    .venv con Python 3.14 (precompila los .pyc para que abra mas rapido)

Uso:
    source .venv/bin/activate
    python scripts/build_installer.py                    # version = fecha de hoy
    python scripts/build_installer.py --version 2026.11.3
"""

import argparse
import compileall
import hashlib
import py_compile
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PACKAGING = PROJECT_ROOT / "packaging" / "windows"
BUILD = PROJECT_ROOT / "build"
STAGING = BUILD / "installer"
CACHE = BUILD / "cache"

PYTHON_VERSION = "3.14.10"
PYTHON_EMBED_URL = f"https://www.python.org/ftp/python/{PYTHON_VERSION}/python-{PYTHON_VERSION}-embed-amd64.zip"
PYTHON_EMBED_SHA256 = "90905e64a840557d8c1bc4f5b74db3d7ee85e3ffb217611cac1c7813acea4159"

# Dependencia de pywebview que solo se publica como codigo fuente (un solo modulo)
PROXY_TOOLS_URL = (
    "https://files.pythonhosted.org/packages/f2/cf/77d3e19b7fabd03895caca7857ef51e4c409e0ca6b37ee6e9f7daa50b642/"
    "proxy_tools-0.1.0.tar.gz"
)
PROXY_TOOLS_SHA256 = "ccb3751f529c047e2d8a58440d86b205303cf0fe8146f784d1cbcd94f0a28010"

# Copia de pythonw.exe con otro nombre: asi aparece en el Administrador de tareas
EXE_NAME = "HistorialPediatrico.exe"
TOTAL_STEPS = 7


def step(n: int, message: str) -> None:
    print(f"[{n}/{TOTAL_STEPS}] {message}")


def fail(message: str) -> None:
    print(f"\nERROR: {message}")
    sys.exit(1)


def download(url: str, sha256: str) -> Path:
    """Descarga a build/cache (una sola vez) y verifica el hash."""
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / url.rsplit("/", 1)[1]
    if not target.exists():
        print(f"  Descargando {url}")
        tmp = target.with_suffix(target.suffix + ".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.rename(target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    if digest != sha256:
        target.unlink()
        fail(f"El hash de {target.name} no coincide (esperado {sha256}, obtenido {digest}).")
    return target


def check_tools() -> None:
    missing = [tool for tool in ("makensis", "npm") if not shutil.which(tool)]
    if missing:
        fail(f"Falta {', '.join(missing)}. Instala makensis con: brew install makensis")


def clean() -> None:
    if STAGING.exists():
        shutil.rmtree(STAGING)
    (STAGING / "app").mkdir(parents=True)
    step(1, "Carpeta build/installer limpiada")


def build_frontend() -> None:
    step(2, "Compilando frontend...")
    frontend_dir = PROJECT_ROOT / "frontend"
    result = subprocess.run(["npm", "run", "build"], cwd=frontend_dir, capture_output=True, text=True)
    if result.returncode != 0:
        fail(f"No se pudo compilar el frontend:\n{result.stdout}\n{result.stderr}")
    shutil.copytree(frontend_dir / "dist", STAGING / "app" / "static")
    print("  Frontend -> app/static/")


def copy_app(version: str) -> None:
    step(3, "Copiando backend y lanzador...")
    app = STAGING / "app"
    shutil.copytree(
        PROJECT_ROOT / "backend" / "src",
        app / "backend" / "src",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    (app / "backend" / "__init__.py").touch()
    shutil.copy2(PACKAGING / "launcher.pyw", app / "launcher.pyw")
    shutil.copy2(PACKAGING / "icon.ico", app / "icon.ico")
    (app / "version.txt").write_text(version + "\n", encoding="utf-8")
    print("  backend/, launcher.pyw, icon.ico, version.txt -> app/")


def install_python() -> None:
    step(4, f"Preparando Python {PYTHON_VERSION} embebido...")
    python_dir = STAGING / "python"
    with zipfile.ZipFile(download(PYTHON_EMBED_URL, PYTHON_EMBED_SHA256)) as z:
        z.extractall(python_dir)

    # El ._pth define sys.path completo del Python embebido
    pth = next(python_dir.glob("python3*._pth"))
    stdlib_zip = pth.with_suffix(".zip").name
    pth.write_text(f"{stdlib_zip}\n.\nLib\\site-packages\n..\\app\nimport site\n", encoding="utf-8")
    shutil.copy2(python_dir / "pythonw.exe", python_dir / EXE_NAME)
    print(f"  python/ ({pth.name} configurado, {EXE_NAME} creado)")


def _pins(path: Path) -> dict:
    pins = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\s*([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*==\s*([^\s;#]+)", line)
        if m:
            pins[re.sub(r"[-_.]+", "-", m.group(1)).lower()] = m.group(2)
    return pins


def install_dependencies() -> None:
    step(5, "Instalando dependencias para Windows (sin internet en la clinica)...")
    requirements = PACKAGING / "requirements-windows.txt"
    windows_pins = _pins(requirements)
    for name, version in _pins(PROJECT_ROOT / "backend" / "requirements.txt").items():
        if name in windows_pins and windows_pins[name] != version:
            print(f"  AVISO: {name} es {version} en backend/requirements.txt pero {windows_pins[name]} en {requirements.name}")

    site = STAGING / "python" / "Lib" / "site-packages"
    result = subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "--target", str(site),
            "--no-deps", "--no-compile", "--only-binary=:all:",
            "--platform", "win_amd64", "--python-version", "3.14", "--implementation", "cp",
            "--disable-pip-version-check", "--quiet",
            "-r", str(requirements),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        fail(f"pip no pudo instalar las dependencias:\n{result.stdout}\n{result.stderr}")
    shutil.rmtree(site / "bin", ignore_errors=True)  # scripts de consola generados para macOS

    with tarfile.open(download(PROXY_TOOLS_URL, PROXY_TOOLS_SHA256)) as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith("proxy_tools/__init__.py"))
        (site / "proxy_tools").mkdir()
        (site / "proxy_tools" / "__init__.py").write_bytes(tar.extractfile(member).read())

    count = len([p for p in site.iterdir() if p.name.endswith(".dist-info")]) + 1
    print(f"  {count} paquetes -> python/Lib/site-packages/")


def precompile() -> None:
    step(6, "Precompilando .pyc...")
    if sys.version_info[:2] != (3, 14):
        print(f"  Omitido: se necesita Python 3.14 para generar .pyc compatibles (este es {sys.version.split()[0]})")
        return
    ok = all(
        compileall.compile_dir(
            path, quiet=1, invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH
        )
        for path in (STAGING / "app", STAGING / "python" / "Lib" / "site-packages")
    )
    print("  Listo" if ok else "  AVISO: algunos archivos no se pudieron precompilar (se compilaran al abrir)")


def make_installer(version: str) -> Path:
    step(7, "Generando instalador con NSIS...")
    numeric = ".".join((version.split(".") + ["0"] * 4)[:4])
    output = BUILD / f"HistorialPediatrico-Setup-{version}.exe"
    result = subprocess.run(
        [
            "makensis", "-V2",
            f"-DVERSION={version}",
            f"-DVERSION_NUMERIC={numeric}",
            f"-DSTAGING={STAGING}",
            f"-DOUTFILE={output}",
            str(PACKAGING / "installer.nsi"),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        fail(f"makensis fallo:\n{result.stdout}\n{result.stderr}")
    return output


def main() -> None:
    today = date.today()
    parser = argparse.ArgumentParser(description="Genera el instalador de Windows")
    parser.add_argument("--version", default=f"{today.year}.{today.month}.{today.day}", help="Version, ej. 2026.11.3 (default: fecha de hoy)")
    args = parser.parse_args()
    if not re.fullmatch(r"\d+(\.\d+){0,3}", args.version):
        fail("La version debe ser numerica, ej. 2026.11.3")

    print("=" * 50)
    print(f" Instalador de Windows — version {args.version}")
    print("=" * 50)
    print()

    check_tools()
    clean()
    build_frontend()
    copy_app(args.version)
    install_python()
    install_dependencies()
    precompile()
    output = make_installer(args.version)

    size_mb = output.stat().st_size / (1024 * 1024)
    sha256 = hashlib.sha256(output.read_bytes()).hexdigest()
    print()
    print("=" * 50)
    print(" Instalador generado!")
    print(f" {output.relative_to(PROJECT_ROOT)} ({size_mb:.1f} MB)")
    print(f" SHA-256: {sha256}")
    print("=" * 50)
    print()
    print("En la PC con Windows:")
    print("  1. Copia el .exe (USB o descarga) y ejecutalo")
    print("  2. La primera vez, el programa pide el respaldo .db de la base de datos")
    print("  3. Para actualizar despues, solo ejecuta el Setup nuevo")


if __name__ == "__main__":
    main()
