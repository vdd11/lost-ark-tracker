import hashlib
import json
import os

import pytest

import updater

NEW = b"new app bytes"
OLD = b"old app bytes"


def release(version="99.0.0", assets=("LostArkTracker-windows.exe", "SHA256SUMS")):
    return {
        "tag_name": f"v{version}",
        "assets": [{"name": name, "browser_download_url": f"https://example.test/{name}"} for name in assets],
    }


def fake_remote(release_data, checksum=None, payload=NEW):
    checksum = checksum or hashlib.sha256(payload).hexdigest()
    texts = {
        updater.RELEASES_API: json.dumps(release_data),
        "https://example.test/SHA256SUMS": f"{checksum}  LostArkTracker-windows.exe\n{'0' * 64}  LostArkTracker-linux\n",
    }

    def fetch(url):
        return texts[url]

    def fetch_file(url, target):
        assert url == "https://example.test/LostArkTracker-windows.exe"
        target.write_bytes(payload)

    return fetch, fetch_file


@pytest.fixture
def exe(tmp_path):
    path = tmp_path / "LostArkTracker.exe"
    path.write_bytes(OLD)
    return path


def test_helpers():
    assert updater.asset_name("win32") == "LostArkTracker-windows.exe"
    assert updater.asset_name("darwin") == "LostArkTracker-macos"
    assert updater.asset_name("linux") == "LostArkTracker-linux"
    assert updater.is_newer("1.18.1", "1.18.0") and updater.is_newer("v1.19.0", "1.18.9")
    assert not updater.is_newer("1.18.0", "1.18.0") and not updater.is_newer("junk", "1.0.0")
    sums = updater.parse_checksums(f"{'a' * 64}  one.exe\n{'B' * 64} *two\nnot a line\n")
    assert sums == {"one.exe": "a" * 64, "two": "b" * 64}


def test_installs_a_verified_download_and_keeps_the_old_file_aside(exe):
    fetch, fetch_file = fake_remote(release())
    assert updater.install_update(exe, fetch, fetch_file, platform="win32") == "99.0.0"
    assert exe.read_bytes() == NEW
    assert updater.old_path(exe).read_bytes() == OLD
    assert not exe.with_name(exe.name + ".download").exists()

    updater.remove_old_copy(exe)  # what the new copy does on start
    assert not updater.old_path(exe).exists()


def test_a_bad_download_changes_nothing(exe):
    fetch, fetch_file = fake_remote(release(), checksum="f" * 64)
    with pytest.raises(updater.UpdateError, match="checksum"):
        updater.install_update(exe, fetch, fetch_file, platform="win32")
    assert exe.read_bytes() == OLD
    assert not updater.old_path(exe).exists()
    assert not exe.with_name(exe.name + ".download").exists()


@pytest.mark.parametrize(
    "data, message",
    [
        (release(version="0.0.1"), "already have the latest"),
        (release(assets=("LostArkTracker-windows.exe",)), "no checksums"),
        (release(assets=("LostArkTracker-linux", "SHA256SUMS")), "no download for this system"),
    ],
)
def test_refuses_what_it_cant_verify(exe, data, message):
    fetch, fetch_file = fake_remote(data)
    with pytest.raises(updater.UpdateError, match=message):
        updater.install_update(exe, fetch, fetch_file, platform="win32")
    assert exe.read_bytes() == OLD


def test_offline_is_a_clear_error(exe):
    def fetch(url):
        raise OSError("no network")

    with pytest.raises(updater.UpdateError, match="Couldn't reach GitHub"):
        updater.install_update(exe, fetch, lambda url, target: None, platform="win32")


def test_a_failed_swap_puts_the_old_file_back(exe, monkeypatch):
    fetch, fetch_file = fake_remote(release())
    real_replace = os.replace

    def replace(src, dst):
        if str(src).endswith(".download"):
            raise PermissionError("locked")
        real_replace(src, dst)

    monkeypatch.setattr(updater.os, "replace", replace)
    with pytest.raises(updater.UpdateError, match="Couldn't install"):
        updater.install_update(exe, fetch, fetch_file, platform="win32")
    assert exe.read_bytes() == OLD


def test_routes(client, exe, monkeypatch):
    # Running from source: nothing to replace.
    assert client.get("/api/update/status").json()["supported"] is False
    assert client.post("/api/update/install").status_code == 400

    started, exits = [], []
    monkeypatch.setattr(updater, "running_executable", lambda: exe)
    monkeypatch.setattr(updater, "install_update", lambda path: "99.0.0")
    monkeypatch.setattr(updater, "start_new_copy", lambda path, argv: started.append(path))
    monkeypatch.setattr(updater, "request_exit", lambda: exits.append(True))
    monkeypatch.setattr("routes.update.EXIT_DELAY_SECONDS", 0)

    assert client.get("/api/update/status").json()["supported"] is True
    response = client.post("/api/update/install")
    assert response.status_code == 200 and response.json() == {"version": "99.0.0"}
    assert started == [exe]

    def fail(path):
        raise updater.UpdateError("The download didn't match its checksum")

    monkeypatch.setattr(updater, "install_update", fail)
    response = client.post("/api/update/install")
    assert response.status_code == 400 and "checksum" in response.json()["detail"]


def test_the_new_copy_starts_fresh_and_waits_for_this_one(exe, monkeypatch):
    calls = []
    monkeypatch.setattr(updater.subprocess, "Popen", lambda args, **kwargs: calls.append((args, kwargs)))
    updater.start_new_copy(exe, ["--port", "8777", "--after-update", "--no-tray"])
    args, kwargs = calls[0]
    assert args == [str(exe), "--port", "8777", "--no-tray", "--after-update"]
    assert kwargs["env"]["PYINSTALLER_RESET_ENVIRONMENT"] == "1"
