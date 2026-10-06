"""Update the packaged app in place: "Update now" in the update dialog.

Only when the user asks (the update check that shows the dialog is opt-in):
fetch the latest GitHub release, download this system's file next to the
running one, check it against the release's SHA256SUMS, then swap it in.
Windows lets a running .exe be renamed but not overwritten, so the current
file moves aside to `<name>.old<suffix>` and is deleted on the next start.
If anything fails before the swap, nothing changes; if the swap itself
fails, the old file goes back.

The new copy is started with `--after-update`, waits for this one to let go
of the port (app.py), and the open browser tab reloads itself.
"""

import hashlib
import json
import logging
import os
import ssl
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Callable

import certifi

from version import APP_VERSION

log = logging.getLogger(__name__)

# Overridable so the updater can be tried end to end against a local server.
RELEASES_API = os.environ.get(
    "LOST_ARK_TRACKER_RELEASES_API", "https://api.github.com/repos/vdd11/lost-ark-tracker/releases/latest"
)
CHECKSUMS = "SHA256SUMS"
TIMEOUT_SECONDS = 60
_ssl = ssl.create_default_context(cafile=certifi.where())


class UpdateError(Exception):
    """Why an update couldn't be installed, in words for the user."""


def asset_name(platform: str = sys.platform) -> str:
    """The release file for this system (see .github/workflows/release.yml)."""
    if platform == "win32":
        return "LostArkTracker-windows.exe"
    if platform == "darwin":
        return "LostArkTracker-macos"
    return "LostArkTracker-linux"


def running_executable() -> Path | None:
    """The packaged app's own file; None when running from source (nothing to replace)."""
    return Path(sys.executable).resolve() if getattr(sys, "frozen", False) else None


def old_path(exe: Path) -> Path:
    return exe.with_name(f"{exe.stem}.old{exe.suffix}")


def version_tuple(version: str) -> tuple[int, ...]:
    try:
        return tuple(int(part) for part in version.lstrip("v").split("."))
    except ValueError:
        return ()


def is_newer(latest: str, current: str = APP_VERSION) -> bool:
    return version_tuple(latest) > version_tuple(current)


def parse_checksums(text: str) -> dict[str, str]:
    """`sha256sum` output ("<hex>  <name>", or "<hex> *<name>") -> {name: hex}."""
    sums = {}
    for line in text.splitlines():
        parts = line.strip().split(maxsplit=1)
        if len(parts) == 2 and len(parts[0]) == 64:
            sums[parts[1].lstrip("*").strip()] = parts[0].lower()
    return sums


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _open(url: str, accept: str = "*/*"):
    request = urllib.request.Request(url, headers={"User-Agent": "LostArkTracker-updater", "Accept": accept})
    return urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=_ssl)


def fetch_text(url: str) -> str:
    with _open(url) as response:
        return response.read().decode("utf-8")


def download(url: str, target: Path):
    with _open(url) as response, target.open("wb") as file:
        while chunk := response.read(1 << 20):
            file.write(chunk)


def swap_in(exe: Path, new_file: Path):
    """Put new_file where exe is, keeping the old one aside (Windows can rename a running .exe)."""
    old = old_path(exe)
    try:
        old.unlink(missing_ok=True)
    except OSError:
        pass  # an even older copy still running; renaming over it below fails loudly if so
    os.replace(exe, old)
    try:
        os.replace(new_file, exe)
    except OSError:
        os.replace(old, exe)
        raise
    if sys.platform != "win32":
        exe.chmod(0o755)


def install_update(
    exe: Path,
    fetch: Callable[[str], str] = fetch_text,
    fetch_file: Callable[[str, Path], None] = download,
    platform: str = sys.platform,
) -> str:
    """Download, check and swap in the latest release. Returns its version."""
    try:
        release = json.loads(fetch(RELEASES_API))
    except (OSError, ValueError) as error:
        raise UpdateError(f"Couldn't reach GitHub to download the update ({error}).") from error
    version = str(release.get("tag_name", "")).lstrip("v")
    if not is_newer(version):
        raise UpdateError(f"You already have the latest version ({APP_VERSION}).")

    assets = {a.get("name"): a.get("browser_download_url") for a in release.get("assets", [])}
    name = asset_name(platform)
    if name not in assets:
        raise UpdateError(f"Version {version} has no download for this system.")
    if CHECKSUMS not in assets:
        raise UpdateError(f"Version {version} has no checksums to verify the download, so it can't be installed here.")

    try:
        expected = parse_checksums(fetch(assets[CHECKSUMS])).get(name)
    except (OSError, ValueError) as error:
        raise UpdateError(f"Couldn't download the checksums ({error}).") from error
    if not expected:
        raise UpdateError(f"Version {version}'s checksums don't list {name}.")

    new_file = exe.with_name(f"{exe.name}.download")
    try:
        fetch_file(assets[name], new_file)
        actual = sha256_of(new_file)
        if actual != expected:
            raise UpdateError("The download didn't match its checksum, so it wasn't installed. Try again later.")
        swap_in(exe, new_file)
    except OSError as error:
        raise UpdateError(f"Couldn't install the update ({error}).") from error
    finally:
        new_file.unlink(missing_ok=True)
    log.info("Installed %s %s over %s", name, version, APP_VERSION)
    return version


def start_new_copy(exe: Path, argv: list[str]):
    """Launch the updated app, detached, telling it to wait for this one to exit."""
    args = [str(exe), *[a for a in argv if a != "--after-update"], "--after-update"]
    # A PyInstaller app started from another one would otherwise reuse this
    # one's unpacked files, which go away when this copy exits.
    env = {**os.environ, "PYINSTALLER_RESET_ENVIRONMENT": "1"}
    if sys.platform == "win32":
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(args, creationflags=flags, close_fds=True, env=env)
    else:
        subprocess.Popen(args, start_new_session=True, close_fds=True, env=env)


def remove_old_copy(exe: Path | None, attempts: int = 1, wait_seconds: float = 2.0) -> bool:
    """After an update, the previous file can go. Right after the restart the
    old copy may still be letting go of it, so this can try a few times."""
    if exe is None:
        return True
    for attempt in range(attempts):
        try:
            old_path(exe).unlink(missing_ok=True)
            return True
        except OSError:
            if attempt + 1 < attempts:
                time.sleep(wait_seconds)
    log.info("Couldn't remove %s yet; it goes on the next start", old_path(exe))
    return False


# Set by app.py: stop the server (and the tray icon) so the new copy can start.
request_exit: Callable[[], None] | None = None
