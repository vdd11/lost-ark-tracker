"""Desktop entry point: serve the API and the built frontend, then open a browser.

This is what the packaged executable runs. From source it works too, once the
frontend has been exported (`npm run build` in frontend/):

    python app.py [--port 8777] [--no-browser] [--no-tray] [--data-dir PATH]

On Windows the packaged app has no console window: it lives in the system
tray (tray.py) and reports problems in a message box. Elsewhere, and with
--no-tray, it runs in its console as before.
"""

import argparse
import json
import logging
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from logging.handlers import RotatingFileHandler
from pathlib import Path

from tray import Tray, message_box, tray_supported
from version import APP_NAME, APP_VERSION

DEFAULT_PORT = 8777
# The windowed Windows build has no console: nothing to print to.
HAS_CONSOLE = sys.stdout is not None


def say(message: str):
    if HAS_CONSOLE:
        print(message, flush=True)


def user_data_dir() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        return base / "LostArkTracker"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "LostArkTracker"
    base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "lost-ark-tracker"


def frontend_dir() -> Path:
    if getattr(sys, "frozen", False):
        # PyInstaller unpacks bundled data files here.
        return Path(sys._MEIPASS) / "frontend"
    return Path(__file__).resolve().parent.parent / "frontend" / "out"


def is_tracker_running(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/", timeout=1) as response:
            return json.load(response).get("app") == APP_NAME
    except (OSError, ValueError):
        return False


def is_port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def any_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def setup_logging(data_dir: Path) -> Path:
    """Warnings to the console, everything useful to a log file friends can send."""
    log_path = data_dir / "tracker.log"
    file_handler = RotatingFileHandler(log_path, maxBytes=1_000_000, backupCount=2, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handlers: list[logging.Handler] = [file_handler]
    if sys.stderr is not None:
        console = logging.StreamHandler()
        console.setLevel(logging.WARNING)
        handlers.append(console)
    logging.basicConfig(level=logging.INFO, handlers=handlers, force=True)
    return log_path


def wait_before_closing(message: str):
    """Make sure a friend sees what went wrong: a message box when there's no
    console (the Windows tray build), else keep the console window open so it
    can be read (or screenshotted)."""
    if not HAS_CONSOLE:
        message_box(message, error=True)
        return
    print(message, flush=True)
    if getattr(sys, "frozen", False) and sys.stdin and sys.stdin.isatty():
        input("Press Enter to close this window.")


def main():
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true", help="don't open a browser tab")
    parser.add_argument("--no-tray", action="store_true", help="run in the console instead of the system tray (Windows)")
    parser.add_argument("--data-dir", type=Path, default=user_data_dir(), help="where to keep database.db")
    args = parser.parse_args()

    port = args.port
    url = f"http://127.0.0.1:{port}/"

    # Double-clicking the app again just reopens the tab.
    if is_tracker_running(port):
        say(f"{APP_NAME} is already running at {url}")
        if not args.no_browser:
            webbrowser.open(url)
        return

    if not is_port_free(port):
        port = any_free_port()
        url = f"http://127.0.0.1:{port}/"

    static_dir = frontend_dir()
    if not (static_dir / "index.html").is_file():
        sys.exit(f"Frontend not found at {static_dir}. Run `npm run build` in frontend/ first.")

    args.data_dir.mkdir(parents=True, exist_ok=True)
    database_path = args.data_dir / "database.db"
    log_path = setup_logging(args.data_dir)
    logging.getLogger(__name__).info("Starting %s %s on port %s", APP_NAME, APP_VERSION, port)

    # main.py reads these at import time.
    os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
    os.environ["FRONTEND_DIR"] = str(static_dir)

    import uvicorn

    from main import app

    # log_config=None keeps uvicorn on the handlers above instead of its own.
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_config=None, access_log=False))

    if tray_supported() and not args.no_tray:
        run_in_tray(server, url, args.data_dir, log_path, open_browser=not args.no_browser)
        return

    def open_browser_when_ready():
        while not server.started:
            time.sleep(0.1)
        say(f"{APP_NAME} {APP_VERSION} is running at {url}")
        say(f"Data: {database_path}")
        say(f"Log:  {log_path}")
        say("Keep this window open while you use the tracker. Close it to stop.")
        if not args.no_browser:
            webbrowser.open(url)

    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    server.run()


def run_in_tray(server, url: str, data_dir: Path, log_path: Path, open_browser: bool):
    """Serve in a background thread and show the tray icon until Quit."""
    log = logging.getLogger(__name__)
    thread = threading.Thread(target=server.run, name="server", daemon=True)
    thread.start()
    # Startup errors happen in the server thread, so watch for them here.
    deadline = time.monotonic() + 60
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise SystemExit(1)
        time.sleep(0.1)
    log.info("Running at %s (tray)", url)
    if open_browser:
        webbrowser.open(url)

    def stop_server():
        server.should_exit = True

    try:
        Tray(url, data_dir, log_path, on_quit=stop_server).run()
    except Exception:
        log.exception("Couldn't show the tray icon")
        message_box(
            f"{APP_NAME} is running at {url}, but its tray icon couldn't be shown. "
            "To stop it, end LostArkTracker in Task Manager."
        )
    thread.join(timeout=15)



def run():
    error = f"{APP_NAME} stopped because of an error. Details are in tracker.log in your data folder."
    try:
        main()
    except SystemExit as exit_:
        # uvicorn exits with a non-zero code when startup fails (e.g. a
        # database it can't open); SystemExit isn't an Exception.
        if exit_.code not in (0, None):
            wait_before_closing(error)
        raise
    except Exception:
        logging.getLogger(__name__).exception("Fatal error")
        wait_before_closing(error)
        raise


if __name__ == "__main__":
    run()
