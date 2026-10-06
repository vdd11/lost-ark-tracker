import base64
import hashlib
import importlib
import io
import json
import os

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

import update_signing
import updater

NEW = b"new app bytes"
OLD = b"old app bytes"


# A key made for the tests; the app trusts it instead of the real one here.
TEST_KEY = Ed25519PrivateKey.generate()
OTHER_KEY = Ed25519PrivateKey.generate()
BASE = "https://github.com/vdd11/lost-ark-tracker/releases/download/v99.0.0/"


def public(key):
    return base64.b64encode(key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()


def signature(key, data: str):
    return base64.b64encode(key.sign(data.encode())).decode() + "\n"


@pytest.fixture(autouse=True)
def trust_test_key(monkeypatch):
    monkeypatch.setattr(update_signing, "PUBLIC_KEYS", (public(TEST_KEY),))


def release(version="99.0.0", assets=("LostArkTracker-windows.exe", "SHA256SUMS", "SHA256SUMS.sig")):
    return {
        "tag_name": f"v{version}",
        "assets": [{"name": name, "browser_download_url": f"https://github.com/vdd11/lost-ark-tracker/releases/download/v99.0.0/{name}"} for name in assets],
    }


def fake_remote(release_data, checksum=None, payload=NEW, signed_by=TEST_KEY, sig=None):
    checksum = checksum or hashlib.sha256(payload).hexdigest()
    sums = f"{checksum}  LostArkTracker-windows.exe\n{'0' * 64}  LostArkTracker-linux\n"
    texts = {
        updater.RELEASES_API: json.dumps(release_data),
        BASE + "SHA256SUMS": sums,
        BASE + "SHA256SUMS.sig": sig if sig is not None else signature(signed_by, sums),
    }

    def fetch(url):
        return texts[url]

    def fetch_file(url, target):
        assert url == "https://github.com/vdd11/lost-ark-tracker/releases/download/v99.0.0/LostArkTracker-windows.exe"
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
        (release(assets=("LostArkTracker-windows.exe", "SHA256SUMS.sig")), "no checksums"),
        (release(assets=("LostArkTracker-windows.exe", "SHA256SUMS")), "isn't signed"),
        (release(assets=("LostArkTracker-linux", "SHA256SUMS")), "no download for this system"),
    ],
)
def test_refuses_what_it_cant_verify(exe, data, message):
    fetch, fetch_file = fake_remote(data)
    with pytest.raises(updater.UpdateError, match=message):
        updater.install_update(exe, fetch, fetch_file, platform="win32")
    assert exe.read_bytes() == OLD


@pytest.mark.parametrize(
    "remote",
    [
        {"signed_by": OTHER_KEY},  # someone else's key
        {"sig": "not base64!"},
        {"sig": ""},
    ],
)
def test_refuses_checksums_not_signed_by_the_developer(exe, remote):
    fetch, fetch_file = fake_remote(release(), **remote)
    with pytest.raises(updater.UpdateError, match="isn't signed by the developer"):
        updater.install_update(exe, fetch, fetch_file, platform="win32")
    assert exe.read_bytes() == OLD
    assert not updater.old_path(exe).exists()


def test_a_tampered_checksum_file_fails_the_signature(exe):
    fetch, fetch_file = fake_remote(release())

    def tampered(url):
        text = fetch(url)
        return text.replace("0" * 64, "1" * 64) if url.endswith("/SHA256SUMS") else text

    with pytest.raises(updater.UpdateError, match="isn't signed by the developer"):
        updater.install_update(exe, tampered, fetch_file, platform="win32")
    assert exe.read_bytes() == OLD


def test_signature_helper_and_key_rollover():
    good = signature(TEST_KEY, "sums")
    assert update_signing.is_signed(b"sums", good)
    assert not update_signing.is_signed(b"other", good)
    assert not update_signing.is_signed(b"sums", signature(OTHER_KEY, "sums"))
    # Trusting two keys (while rolling in a new one) accepts either; a broken entry is skipped.
    assert update_signing.is_signed(b"sums", signature(OTHER_KEY, "sums"), keys=("garbage", public(TEST_KEY), public(OTHER_KEY)))


def test_the_app_ships_a_real_key():
    # The module as written, not the test key patched in above.
    shipped = importlib.reload(update_signing).PUBLIC_KEYS
    assert shipped and all(len(base64.b64decode(key)) == 32 for key in shipped)


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


def test_only_github_files_over_https(exe):
    for url in ("https://evil.example/LostArkTracker-windows.exe", "http://github.com/LostArkTracker-windows.exe"):
        data = release()
        data["assets"][0]["browser_download_url"] = url
        fetch, fetch_file = fake_remote(data)
        with pytest.raises(updater.UpdateError, match="aren't on GitHub"):
            updater.install_update(exe, fetch, fetch_file, platform="win32")
        assert exe.read_bytes() == OLD


def test_the_release_list_must_come_from_github(exe, monkeypatch):
    monkeypatch.setattr(updater, "RELEASES_API", "https://evil.example/releases/latest")
    with pytest.raises(updater.UpdateError, match="isn't GitHub"):
        updater.install_update(exe, lambda url: "{}", lambda url, target: None, platform="win32")


def test_url_rules():
    assert updater.is_allowed_url("https://github.com/vdd11/lost-ark-tracker/releases/download/v1/x")
    assert updater.is_allowed_url("https://objects.githubusercontent.com/x")
    assert not updater.is_allowed_url("https://github.com.evil.example/x")
    assert not updater.is_allowed_url("http://127.0.0.1:8899/x")  # only with the test-server override
    assert not updater.is_allowed_url("https://api.github.com/x")  # files never come from the API host
    assert updater.is_allowed_url("https://api.github.com/repos/x/releases/latest", updater.API_HOSTS)


def test_redirects_stay_on_github():
    handler = updater._GitHubRedirectsOnly()
    request = updater.urllib.request.Request("https://github.com/x")
    with pytest.raises(updater.urllib.error.URLError, match="evil.example"):
        handler.redirect_request(request, None, 302, "Found", {}, "https://evil.example/x")
    assert handler.redirect_request(request, None, 302, "Found", {}, "https://release-assets.githubusercontent.com/x") is not None


def test_downloads_are_capped():
    out = io.BytesIO()
    updater.copy_capped(io.BytesIO(b"x" * 10), out, limit=10)
    assert out.getvalue() == b"x" * 10
    with pytest.raises(updater.UpdateError, match="far bigger"):
        updater.copy_capped(io.BytesIO(b"x" * 11), io.BytesIO(), limit=10)
