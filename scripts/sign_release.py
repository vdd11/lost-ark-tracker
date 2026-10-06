"""Sign a release's SHA256SUMS and publish it: the last step of a release.

The release workflow publishes each release as a draft. A draft is invisible
to the app's update check, so nobody can install it until this script has
signed its checksums with the private key on this computer (never on GitHub)
and published it. See backend/update_signing.py for why.

Run with the backend venv (it has `cryptography` and `certifi`):

    backend/.venv/Scripts/python scripts/sign_release.py keygen
        Makes the signing key (once) and prints the public key to put in
        update_signing.PUBLIC_KEYS. Back the key file up somewhere safe
        (a password manager): without it the app can't update itself.

    backend/.venv/Scripts/python scripts/sign_release.py publish v1.19.0
        Needs GITHUB_TOKEN: a fine-grained token for this repository with
        "Contents: read and write". Downloads the draft's SHA256SUMS, checks
        the downloads match it, signs it, uploads SHA256SUMS.sig and
        publishes the release.

    backend/.venv/Scripts/python scripts/sign_release.py sign SHA256SUMS
        Just writes SHA256SUMS.sig next to a local file.

The key lives at ~/.lost-ark-tracker/update-signing-key.pem, or wherever
LOST_ARK_TRACKER_SIGNING_KEY points.
"""

import base64
import hashlib
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

import certifi
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
import update_signing  # noqa: E402
import updater  # noqa: E402

REPO = "vdd11/lost-ark-tracker"
API = f"https://api.github.com/repos/{REPO}"
KEY_PATH = Path(os.environ.get("LOST_ARK_TRACKER_SIGNING_KEY", Path.home() / ".lost-ark-tracker" / "update-signing-key.pem"))
_ssl = ssl.create_default_context(cafile=certifi.where())


def public_key_text(key: Ed25519PrivateKey) -> str:
    raw = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return base64.b64encode(raw).decode()


def load_key() -> Ed25519PrivateKey:
    if not KEY_PATH.exists():
        sys.exit(f"No signing key at {KEY_PATH}. Restore it from your backup (or set LOST_ARK_TRACKER_SIGNING_KEY).")
    key = serialization.load_pem_private_key(KEY_PATH.read_bytes(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        sys.exit(f"{KEY_PATH} isn't an Ed25519 key.")
    if public_key_text(key) not in update_signing.PUBLIC_KEYS:
        sys.exit("This key isn't one the app trusts (update_signing.PUBLIC_KEYS), so its signatures would be refused.")
    return key


def sign(key: Ed25519PrivateKey, data: bytes) -> str:
    signature = base64.b64encode(key.sign(data)).decode()
    assert update_signing.is_signed(data, signature)
    return signature + "\n"


def keygen():
    if KEY_PATH.exists():
        key = serialization.load_pem_private_key(KEY_PATH.read_bytes(), password=None)
        print(f"A key already exists at {KEY_PATH}; not replacing it.")
    else:
        key = Ed25519PrivateKey.generate()
        KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
        pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
        KEY_PATH.write_bytes(pem)
        if os.name != "nt":
            KEY_PATH.chmod(0o600)
        print(f"Made a signing key at {KEY_PATH}. Back it up somewhere safe; never commit it.")
    print(f"Public key (for update_signing.PUBLIC_KEYS): {public_key_text(key)}")


def github(method: str, url: str, data: bytes | None = None, content_type: str = "application/json", accept: str = "application/vnd.github+json"):
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("Set GITHUB_TOKEN to a fine-grained token for this repository with Contents: read and write.")
    request = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Accept": accept,
        "Content-Type": content_type,
        "User-Agent": "LostArkTracker-release",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    try:
        with urllib.request.urlopen(request, context=_ssl, timeout=300) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        sys.exit(f"GitHub said {error.code} to {method} {url}: {error.read().decode(errors='replace')[:300]}")


def publish(tag: str):
    key = load_key()
    releases = json.loads(github("GET", f"{API}/releases?per_page=30"))
    release = next((r for r in releases if r["tag_name"] == tag), None)
    if release is None:
        sys.exit(f"No release for {tag} yet; wait for the release workflow to finish.")
    if not release["draft"]:
        sys.exit(f"{tag} is already published.")
    assets = {a["name"]: a for a in release["assets"]}
    if updater.CHECKSUMS not in assets:
        sys.exit(f"{tag} has no {updater.CHECKSUMS}.")

    def download(name: str) -> bytes:
        return github("GET", assets[name]["url"], accept="application/octet-stream")

    checksums = download(updater.CHECKSUMS)
    listed = updater.parse_checksums(checksums.decode())
    # Sign only what the checksums really describe.
    for platform in ("win32", "darwin", "linux"):
        name = updater.asset_name(platform)
        if name not in assets or name not in listed:
            sys.exit(f"{tag} is missing {name} or its checksum.")
        if hashlib.sha256(download(name)).hexdigest() != listed[name]:
            sys.exit(f"{name} doesn't match {updater.CHECKSUMS}; not signing.")
        print(f"checked {name}")

    if update_signing.SIGNATURE_ASSET in assets:
        github("DELETE", assets[update_signing.SIGNATURE_ASSET]["url"])
    upload = release["upload_url"].split("{")[0] + f"?name={update_signing.SIGNATURE_ASSET}"
    github("POST", upload, sign(key, checksums).encode(), content_type="text/plain")
    github("PATCH", f"{API}/releases/{release['id']}", json.dumps({"draft": False, "make_latest": "true"}).encode())
    print(f"Signed and published {tag}: {release['html_url'].replace('/untagged-', '/tag/')}")


def main(argv: list[str]):
    if argv[:1] == ["keygen"]:
        keygen()
    elif len(argv) == 2 and argv[0] == "publish":
        publish(argv[1])
    elif len(argv) == 2 and argv[0] == "sign":
        path = Path(argv[1])
        target = path.with_name(path.name + ".sig")
        target.write_text(sign(load_key(), path.read_bytes()), encoding="utf-8")
        print(f"wrote {target}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
