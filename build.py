"""Build the standalone Lost Ark Tracker executable into dist/.

Run with the Python environment that has backend/requirements-dev.txt
installed, from anywhere:

    python build.py              # export the frontend, then package
    python build.py --skip-frontend

The result is dist/LostArkTracker(.exe), a single file that needs neither
Python nor Node on the machine it runs on.
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
NAME = "LostArkTracker"


def run(command: list[str], cwd: Path):
    print(f"> {' '.join(command)}", flush=True)
    # npm is a .cmd script on Windows, which needs the shell to resolve.
    subprocess.run(command, cwd=cwd, check=True, shell=sys.platform == "win32" and command[0] == "npm")


def build_frontend():
    if not (FRONTEND / "node_modules").is_dir():
        run(["npm", "ci"], FRONTEND)
    shutil.rmtree(FRONTEND / "out", ignore_errors=True)
    run(["npm", "run", "build"], FRONTEND)


def build_executable():
    out = FRONTEND / "out"
    if not (out / "index.html").is_file():
        sys.exit("frontend/out is missing. Build the frontend first.")

    run([
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name", NAME,
        "--paths", str(BACKEND),
        "--add-data", f"{out}{os.pathsep}frontend",
        "--distpath", str(ROOT / "dist"),
        "--workpath", str(ROOT / "build"),
        "--specpath", str(ROOT / "build"),
        str(BACKEND / "app.py"),
    ], ROOT)

    suffix = ".exe" if sys.platform == "win32" else ""
    print(f"\nBuilt {ROOT / 'dist' / (NAME + suffix)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-frontend", action="store_true", help="reuse the existing frontend/out")
    args = parser.parse_args()

    if not args.skip_frontend:
        build_frontend()
    build_executable()


if __name__ == "__main__":
    main()
