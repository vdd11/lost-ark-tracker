"""Desktop entry point: serve the API and the built frontend, then open a browser.

This is what the packaged executable runs. From source it works too, once the
frontend has been exported (`npm run build` in frontend/):

    python app.py [--port 8777] [--no-browser] [--data-dir PATH]
"""

import argparse
import json
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

from version import APP_NAME, APP_VERSION

DEFAULT_PORT = 8777


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


def main():
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true", help="don't open a browser tab")
    parser.add_argument("--data-dir", type=Path, default=user_data_dir(), help="where to keep database.db")
    args = parser.parse_args()

    port = args.port
    url = f"http://127.0.0.1:{port}/"

    # Double-clicking the app again just reopens the tab.
    if is_tracker_running(port):
        print(f"{APP_NAME} is already running at {url}")
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

    # main.py reads these at import time.
    os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
    os.environ["FRONTEND_DIR"] = str(static_dir)

    import uvicorn

    from main import app

    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))

    def open_browser_when_ready():
        while not server.started:
            time.sleep(0.1)
        print(f"{APP_NAME} {APP_VERSION} is running at {url}", flush=True)
        print(f"Data: {database_path}", flush=True)
        print("Keep this window open while you use the tracker. Close it to stop.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)

    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    server.run()


if __name__ == "__main__":
    main()
