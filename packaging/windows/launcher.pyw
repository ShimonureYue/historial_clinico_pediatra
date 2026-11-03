"""
launcher.pyw — Historia Clinica Pediatrica como programa de escritorio.

Abre el sistema en una ventana propia usando WebView2 (el motor de Edge que
viene con Windows 11), sin navegador. El servidor FastAPI corre dentro del
mismo proceso y se detiene al cerrar la ventana.

Carpeta de datos (el instalador nunca la toca):
    %LOCALAPPDATA%\\HistorialPediatrico\\
        database\\historial_pediatrico.db
        database\\backups\\diarios\\    respaldo automatico, uno por dia
        config.env                    SECRET_KEY y llaves de S3
        logs\\app.log                  diagnostico
        webview\\                      sesion y preferencias de la ventana

La primera vez que se abre en un equipo pide el respaldo .db (de S3 o USB) y
lo importa. Si junto al .db (o en la carpeta de arriba) hay un .env, toma de
ahi las llaves de S3.

Prueba sin ventana (sirve en macOS):
    python packaging/windows/launcher.pyw --smoke-test --data-dir /tmp/hc --db respaldo.db
"""

import argparse
import ctypes
import html
import json
import logging
import os
import platform
import secrets
import shutil
import socket
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import date
from logging.handlers import RotatingFileHandler
from pathlib import Path

TITLE = "Historia Clínica Pediátrica"  # el instalador busca la ventana abierta por este titulo
APP_ID = "HistorialPediatrico"
DB_NAME = "historial_pediatrico.db"
DAILY_BACKUPS_KEPT = 14
PORTS = range(8000, 8020)
S3_KEYS = ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BACKUP_BUCKET", "S3_BACKUP_PREFIX", "AWS_DEFAULT_REGION")
IS_WINDOWS = sys.platform == "win32"

HERE = Path(__file__).resolve().parent
# Instalado: launcher.pyw vive junto a backend/ y static/. En el repo: dos niveles arriba.
APP_DIR = HERE if (HERE / "backend" / "src" / "main.py").is_file() else HERE.parent.parent

log = logging.getLogger("launcher")

CONFIG_TEMPLATE = """\
# Configuracion de Historia Clinica Pediatrica (creada por el programa).
# Despues de editar este archivo, cierra el programa y vuelve a abrirlo.

SECRET_KEY={secret}

# Respaldos a AWS S3 (opcional). Copia aqui los valores de tu .env anterior.
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BACKUP_BUCKET=
S3_BACKUP_PREFIX=
AWS_DEFAULT_REGION=us-east-1
"""


class Paths:
    def __init__(self, data_dir: Path):
        self.data = data_dir
        self.db_dir = data_dir / "database"
        self.db = self.db_dir / DB_NAME
        self.daily_backups = self.db_dir / "backups" / "diarios"
        self.config = data_dir / "config.env"
        self.logs = data_dir / "logs"
        self.webview = data_dir / "webview"


def default_data_dir() -> Path:
    if os.environ.get("HISTORIAL_DATA_DIR"):
        return Path(os.environ["HISTORIAL_DATA_DIR"])
    if IS_WINDOWS:
        return Path(os.environ["LOCALAPPDATA"]) / APP_ID
    return Path.home() / f".{APP_ID.lower()}"


def app_version() -> str:
    version_file = HERE / "version.txt"
    return version_file.read_text(encoding="utf-8").strip() if version_file.is_file() else "dev"


def setup_logging(paths: Paths) -> None:
    paths.logs.mkdir(parents=True, exist_ok=True)
    has_console = sys.stderr is not None
    if not has_console:
        # pythonw.exe no tiene consola: cualquier print o traceback suelto va a un archivo
        stream = open(paths.logs / "salida.log", "a", encoding="utf-8", buffering=1)
        sys.stdout = sys.stdout or stream
        sys.stderr = stream

    handlers = [RotatingFileHandler(paths.logs / "app.log", maxBytes=1_000_000, backupCount=5, encoding="utf-8")]
    if has_console:
        handlers.append(logging.StreamHandler())
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", handlers=handlers)

    sys.excepthook = lambda *exc: log.critical("Error no controlado", exc_info=exc)
    threading.excepthook = lambda a: log.critical(
        "Error no controlado en hilo %s", a.thread.name if a.thread else "?",
        exc_info=(a.exc_type, a.exc_value, a.exc_traceback),
    )


# ── Una sola instancia ────────────────────────────────────────────────────────

_mutex = None


def already_running() -> bool:
    """True si el programa ya esta abierto; en ese caso trae su ventana al frente."""
    global _mutex
    if not IS_WINDOWS:
        return False
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateMutexW.restype = ctypes.c_void_p
    _mutex = kernel32.CreateMutexW(None, False, f"Local\\{APP_ID}")
    if ctypes.get_last_error() != 183:  # ERROR_ALREADY_EXISTS
        return False

    user32 = ctypes.WinDLL("user32")
    user32.FindWindowW.restype = ctypes.c_void_p
    user32.FindWindowW.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p]
    user32.IsIconic.argtypes = [ctypes.c_void_p]
    user32.ShowWindow.argtypes = [ctypes.c_void_p, ctypes.c_int]
    user32.SetForegroundWindow.argtypes = [ctypes.c_void_p]
    hwnd = user32.FindWindowW(None, TITLE)
    if hwnd:
        if user32.IsIconic(hwnd):
            user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.SetForegroundWindow(hwnd)
    return True


# ── config.env ────────────────────────────────────────────────────────────────

def read_env(path: Path) -> dict:
    """Parsea un archivo KEY=VALUE (mismo formato que el .env del backend)."""
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        values[key.strip()] = value
    return values


def ensure_config(paths: Paths) -> None:
    if not paths.config.exists():
        paths.data.mkdir(parents=True, exist_ok=True)
        paths.config.write_text(CONFIG_TEMPLATE.format(secret=secrets.token_urlsafe(48)), encoding="utf-8")
        log.info("config.env creado con una SECRET_KEY nueva")


def import_s3_settings(paths: Paths, env_file: Path) -> None:
    """Copia las llaves de S3 de un .env anterior a config.env."""
    found = {k: v for k, v in read_env(env_file).items() if k in S3_KEYS and v}
    if not found:
        return
    lines = paths.config.read_text(encoding="utf-8").splitlines()
    pending = dict(found)
    for i, line in enumerate(lines):
        key = line.partition("=")[0].strip()
        if key in pending and not line.lstrip().startswith("#"):
            lines[i] = f"{key}={pending.pop(key)}"
    lines += [f"{key}={value}" for key, value in pending.items()]
    paths.config.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log.info("Configuracion de S3 importada de %s", env_file)


def find_old_env(db_file: Path) -> Path | None:
    """El .env del sistema anterior: junto al .db, o un nivel arriba si se copio
    la carpeta completa (HistorialPediatrico\\.env + database\\historial_pediatrico.db)."""
    for folder in (db_file.parent, db_file.parent.parent):
        for name in (".env", "backup_config.env"):
            if (folder / name).is_file():
                return folder / name
    return None


def prepare_backend(paths: Paths) -> None:
    """Deja listas las variables de entorno antes de importar el backend."""
    ensure_config(paths)
    for key, value in read_env(paths.config).items():
        if value:
            os.environ.setdefault(key, value)
    os.environ["DB_PATH"] = str(paths.db)
    if str(APP_DIR) not in sys.path:
        sys.path.insert(0, str(APP_DIR))


# ── Base de datos ─────────────────────────────────────────────────────────────

class InvalidDatabase(Exception):
    pass


def import_database(source: Path, paths: Paths) -> int:
    """Copia un respaldo .db a la carpeta de datos. Devuelve cuantos pacientes tiene."""
    with open(source, "rb") as f:
        if f.read(16) != b"SQLite format 3\x00":
            raise InvalidDatabase("El archivo no es una base de datos SQLite.")

    paths.db_dir.mkdir(parents=True, exist_ok=True)
    work = paths.db_dir / "importando"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir()
    tmp = paths.db_dir / f"{DB_NAME}.tmp"
    try:
        # Se trabaja sobre una copia para no tocar el original (USB) y para
        # incluir el -wal si se copio la carpeta database completa a mano.
        copy = work / DB_NAME
        shutil.copy2(source, copy)
        if Path(f"{source}-wal").is_file():
            shutil.copy2(f"{source}-wal", f"{copy}-wal")

        src = sqlite3.connect(copy)
        try:
            if src.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise InvalidDatabase("La base de datos está dañada.")
            tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
            if not {"pacientes", "consultas", "usuarios"} <= tables:
                raise InvalidDatabase("El archivo no es una base de datos de Historia Clínica Pediátrica.")
            patients = src.execute("SELECT COUNT(*) FROM pacientes").fetchone()[0]

            tmp.unlink(missing_ok=True)
            dst = sqlite3.connect(tmp)
            try:
                src.backup(dst)
            finally:
                dst.close()
        except sqlite3.DatabaseError as e:
            raise InvalidDatabase(f"No se pudo leer la base de datos: {e}")
        finally:
            src.close()
        os.replace(tmp, paths.db)
    finally:
        shutil.rmtree(work, ignore_errors=True)
        tmp.unlink(missing_ok=True)

    log.info("Base de datos importada de %s (%d pacientes)", source, patients)
    return patients


def daily_backup(paths: Paths) -> None:
    """Un respaldo local por dia con la API de backup de SQLite (incluye lo pendiente en el WAL)."""
    try:
        paths.daily_backups.mkdir(parents=True, exist_ok=True)
        target = paths.daily_backups / f"historial_pediatrico_{date.today():%Y-%m-%d}.db"
        if target.exists():
            return
        tmp = target.with_suffix(".tmp")
        src = sqlite3.connect(paths.db)
        dst = sqlite3.connect(tmp)
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
        os.replace(tmp, target)
        for old in sorted(paths.daily_backups.glob("historial_pediatrico_*.db"))[:-DAILY_BACKUPS_KEPT]:
            old.unlink()
        log.info("Respaldo diario creado: %s", target.name)
    except Exception:
        log.exception("No se pudo crear el respaldo diario")


# ── Servidor ──────────────────────────────────────────────────────────────────

def pick_port() -> int:
    """8000 de preferencia: la sesion guardada en la ventana depende del puerto."""
    for port in PORTS:
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No hay puertos libres entre {PORTS.start} y {PORTS.stop - 1}.")


class Server:
    def __init__(self, port: int):
        self.port = port
        self.url = f"http://127.0.0.1:{port}/"
        self._server = None
        self._thread = None

    def start(self) -> None:
        import uvicorn
        from backend.src.main import app  # al importarse aplica las migraciones a la base

        config = uvicorn.Config(app, host="127.0.0.1", port=self.port, log_config=None, access_log=False)
        self._server = uvicorn.Server(config)
        self._thread = threading.Thread(target=self._server.run, name="servidor", daemon=True)
        self._thread.start()

        deadline = time.monotonic() + 60
        while not self._server.started:
            if not self._thread.is_alive():
                raise RuntimeError(f"El servidor no pudo iniciar en el puerto {self.port}.")
            if time.monotonic() > deadline:
                raise RuntimeError("El servidor tardó demasiado en iniciar.")
            time.sleep(0.1)
        log.info("Servidor listo en %s", self.url)

    def stop(self) -> None:
        if self._server:
            self._server.should_exit = True
            self._thread.join(timeout=10)
            log.info("Servidor detenido")


# ── Prueba sin ventana ────────────────────────────────────────────────────────

def _request(url: str, data: dict | None = None) -> tuple[int, bytes]:
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def smoke_test(paths: Paths, source_db: str | None) -> int:
    if not paths.db.exists():
        if not source_db:
            print(f"No hay base de datos en {paths.db}; usa --db para importar un respaldo.")
            return 2
        print(f"Base importada: {import_database(Path(source_db), paths)} pacientes")
    daily_backup(paths)
    prepare_backend(paths)

    server = Server(pick_port())
    server.start()
    try:
        checks = [("health", _request(server.url + "api/health") == (200, b'{"status":"ok"}'))]
        status, _ = _request(server.url + "api/auth/login", {"correo": "nadie@ejemplo.com", "password": "x"})
        checks.append(("login rechaza credenciales malas", status == 401))
        if (APP_DIR / "static" / "index.html").is_file():
            status, body = _request(server.url + "pacientes")
            checks.append(("frontend (SPA)", status == 200 and b'id="root"' in body))
    finally:
        server.stop()

    for name, ok in checks:
        print(f"  [{'OK' if ok else 'FALLO'}] {name}")
    return 0 if all(ok for _, ok in checks) else 1


# ── Ventana ───────────────────────────────────────────────────────────────────

PAGE_STYLE = """
  :root { color-scheme: light dark; }
  body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
         font: 15px "Segoe UI", system-ui, sans-serif; background: #f8fafc; color: #334155; }
  @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #cbd5e1; } }
  .box { text-align: center; max-width: 560px; padding: 24px; }
  .spin { width: 28px; height: 28px; margin: 0 auto 14px; border: 3px solid #89D5CE;
          border-top-color: #0A8F83; border-radius: 50%; animation: s 1s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
  code { font-size: 12px; word-break: break-all; }
"""


def loading_html(url: str) -> str:
    # Se redirige sola en cuanto responde el servidor; location.replace evita que
    # "Atras" regrese a esta pantalla.
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><style>{PAGE_STYLE}</style></head>
<body><div class="box"><div class="spin"></div>Iniciando {TITLE}…</div>
<script>
  (function poll() {{
    fetch("{url}api/health", {{ mode: "no-cors", cache: "no-store" }})
      .then(function () {{ location.replace("{url}"); }})
      .catch(function () {{ setTimeout(poll, 400); }});
  }})();
</script></body></html>"""


def error_html(message: str, log_file: Path) -> str:
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><style>{PAGE_STYLE}</style></head>
<body><div class="box"><h2>No se pudo iniciar el programa</h2><p>{html.escape(message)}</p>
<p>Cierra la ventana y vuelve a abrirlo. Si el problema sigue, envía este archivo a soporte:</p>
<code>{html.escape(str(log_file))}</code></div></body></html>"""


def tune_webview2() -> None:
    """Ajusta el comportamiento de pywebview en Windows para que se use como el navegador de hoy."""
    from webview.platforms import edgechromium

    edge = edgechromium.EdgeChrome
    original_ready = edge.on_webview_ready

    def on_webview_ready(self, sender, args):
        original_ready(self, sender, args)
        if args.IsSuccess:
            settings = sender.CoreWebView2.Settings
            settings.AreDefaultContextMenusEnabled = True  # clic derecho: copiar, pegar, corrector
            settings.AreBrowserAcceleratorKeysEnabled = True  # Ctrl+P, Ctrl+F, F5

    def on_new_window_request(self, sender, args):
        uri = str(args.get_Uri())
        if uri.startswith(("blob:", "http://127.0.0.1")):
            # Sin marcarlo como manejado, WebView2 abre su propia ventana. Asi la
            # receta PDF (window.open de un blob) sale con visor e impresion.
            return
        args.set_Handled(True)
        webbrowser.open(uri)

    edge.on_webview_ready = on_webview_ready
    edge.on_new_window_request = on_new_window_request


def obtain_database(window, paths: Paths, source_db: str | None) -> bool:
    """Primera vez en este equipo: pide el respaldo .db y lo importa. False si se cancela."""
    import webview

    ensure_config(paths)
    candidate = Path(source_db) if source_db else None
    while True:
        if candidate is None:
            if not window.create_confirmation_dialog(
                TITLE,
                "Este equipo todavía no tiene la base de datos de pacientes.\n\n"
                "A continuación selecciona el archivo de respaldo (.db) que descargaste "
                "de S3 o copiaste de la USB.",
            ):
                return False
            chosen = window.create_file_dialog(
                webview.FileDialog.OPEN, file_types=("Base de datos (*.db)", "Todos los archivos (*.*)")
            )
            if not chosen:
                continue
            candidate = Path(chosen[0])
        try:
            import_database(candidate, paths)
        except (InvalidDatabase, OSError) as e:
            log.warning("No se pudo importar %s: %s", candidate, e)
            if not window.create_confirmation_dialog(TITLE, f"No se pudo usar ese archivo:\n{e}\n\n¿Quieres elegir otro?"):
                return False
            candidate = None
            continue
        env_file = find_old_env(candidate)
        if env_file:
            import_s3_settings(paths, env_file)
        return True


def boot(window, paths: Paths, server: Server, source_db: str | None) -> None:
    closed = threading.Event()
    window.events.closed += closed.set
    try:
        if not paths.db.exists() and not obtain_database(window, paths, source_db):
            window.destroy()
            return
        daily_backup(paths)
        prepare_backend(paths)
        server.start()
        # La pantalla de carga se redirige sola; esto cubre el caso de que no lo haga.
        if closed.wait(3):
            return
        if not (window.get_current_url() or "").startswith(server.url):
            window.load_url(server.url)
    except Exception as e:
        if closed.is_set():
            return
        log.exception("Error al iniciar")
        window.load_html(error_html(str(e), paths.logs / "app.log"))


def run_window(paths: Paths, args) -> None:
    import webview

    if IS_WINDOWS:
        tune_webview2()
    webview.settings["ALLOW_DOWNLOADS"] = True

    server = Server(pick_port())
    window = webview.create_window(
        TITLE,
        html=loading_html(server.url),
        width=1280,
        height=800,
        min_size=(1024, 640),
        maximized=True,
        text_select=True,  # pywebview bloquea seleccionar texto por defecto
        zoomable=True,  # Ctrl + rueda, como en el navegador
    )
    icon = HERE / "icon.ico"
    webview.start(
        boot,
        (window, paths, server, args.db),
        private_mode=False,  # conserva la sesion y el modo oscuro entre aperturas
        storage_path=str(paths.webview),
        icon=str(icon) if icon.is_file() else None,
        debug=args.debug,
    )
    server.stop()


def main() -> int:
    parser = argparse.ArgumentParser(description=TITLE)
    parser.add_argument("--data-dir", type=Path, default=None, help="Carpeta de datos (default: %%LOCALAPPDATA%%\\HistorialPediatrico)")
    parser.add_argument("--db", help="Respaldo .db a importar si este equipo aun no tiene base de datos")
    parser.add_argument("--smoke-test", action="store_true", help="Inicia el servidor sin ventana, lo prueba y sale")
    parser.add_argument("--debug", action="store_true", help="Habilita las herramientas de desarrollador")
    args = parser.parse_args()

    paths = Paths(args.data_dir or default_data_dir())
    setup_logging(paths)
    log.info("%s %s (Python %s) — datos en %s", TITLE, app_version(), platform.python_version(), paths.data)

    if args.smoke_test:
        return smoke_test(paths, args.db)
    if already_running():
        log.info("Ya estaba abierto; se trajo la ventana al frente")
        return 0
    run_window(paths, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
