"""Start the packaged app and check it really serves the API and the page.

    python scripts/smoke_test.py dist/LostArkTracker.exe
    python scripts/smoke_test.py dist/LostArkTracker --expect-version 1.14.0

Runs the binary on a free port with a throwaway data folder, waits for
GET /api/ to answer as Lost Ark Tracker (at the expected version, if given),
checks GET / returns the app's page, then stops it. Exits 1 with the app's
output and log if anything fails. Standard library only, so CI can run it on
Windows, macOS and Linux right after build.py.
"""

import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

APP_NAME = "Lost Ark Tracker"


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def get(url: str) -> tuple[int, str]:
    with urllib.request.urlopen(url, timeout=5) as response:
        return response.status, response.read().decode("utf-8", errors="replace")


def stop(process: subprocess.Popen):
    """Stop the whole tree: a one-file PyInstaller exe is a parent that unpacks
    plus a child that serves."""
    if process.poll() is not None:
        return
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)], capture_output=True)
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=10)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        pass


def wait_for_api(base: str, process: subprocess.Popen, deadline: float) -> dict:
    last_error = "no answer yet"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"the app exited early with code {process.returncode}")
        try:
            status, body = get(f"{base}/api/")
            if status == 200:
                return json.loads(body)
            last_error = f"HTTP {status}"
        except (urllib.error.URLError, ConnectionError, OSError, json.JSONDecodeError) as error:
            last_error = str(error)
        time.sleep(0.5)
    raise RuntimeError(f"GET /api/ didn't answer in time ({last_error})")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("binary", type=Path)
    parser.add_argument("--expect-version", help="fail unless /api/ reports this version")
    parser.add_argument("--timeout", type=float, default=90, help="seconds to wait for startup")
    args = parser.parse_args()

    binary = args.binary.resolve()
    if not binary.is_file():
        print(f"FAIL: {binary} doesn't exist. Build it first with: python build.py")
        return 1

    port = free_port()
    base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(prefix="lat-smoke-") as tmp:
        data_dir = Path(tmp) / "data"
        output_path = Path(tmp) / "output.txt"
        started = time.monotonic()
        with open(output_path, "wb") as output:
            process = subprocess.Popen(
                [str(binary), "--no-browser", "--port", str(port), "--data-dir", str(data_dir)],
                stdin=subprocess.DEVNULL,  # an error prompt ("press Enter") can't hang the run
                stdout=output,
                stderr=subprocess.STDOUT,
                start_new_session=sys.platform != "win32",
            )
            try:
                info = wait_for_api(base, process, started + args.timeout)
                if info.get("app") != APP_NAME:
                    raise RuntimeError(f"GET /api/ answered as {info!r}, not {APP_NAME}")
                if args.expect_version and info.get("version") != args.expect_version:
                    raise RuntimeError(f"version is {info.get('version')!r}, expected {args.expect_version!r}")
                status, page = get(f"{base}/")
                if status != 200 or f"<title>{APP_NAME}</title>" not in page:
                    raise RuntimeError(f"GET / didn't return the app's page (HTTP {status})")
            except Exception as error:  # noqa: BLE001 - report anything, then clean up
                print(f"FAIL: {error}")
                stop(process)
                print("--- app output ---")
                print(output_path.read_text(errors="replace")[-4000:] or "(none)")
                log = data_dir / "tracker.log"
                if log.exists():
                    print("--- tracker.log ---")
                    print(log.read_text(errors="replace")[-4000:])
                return 1
            stop(process)

    print(f"OK: {APP_NAME} {info.get('version')} served /api/ and / in {time.monotonic() - started:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
