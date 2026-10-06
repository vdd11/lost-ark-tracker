"""Signed updates: "Update now" only installs a release whose SHA256SUMS is
signed by the developer's key.

SHA256SUMS alone only shows a download arrived intact, since it comes from
the same release. The signature (Ed25519, in the release's SHA256SUMS.sig)
is made on the developer's own computer with a private key that never goes
to GitHub (`scripts/sign_release.py`), so someone who took over the GitHub
account or the release build still couldn't push an update through the app.

PUBLIC_KEYS can hold more than one key so a new key can be rolled in: ship
a release that trusts both, then sign with the new one. If every private key
is lost, the app can't update itself any more and people download the next
version by hand.
"""

import base64
import binascii

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

SIGNATURE_ASSET = "SHA256SUMS.sig"

# Raw 32-byte Ed25519 public keys, base64.
PUBLIC_KEYS: tuple[str, ...] = (
    "mO3syQxELJ2Kmh4c6yAXSr+U9iJ5ggvasQNZD4byhuU=",  # made 2026-10-06
)


def is_signed(data: bytes, signature_text: str, keys: tuple[str, ...] | None = None) -> bool:
    """Whether signature_text (base64, as in SHA256SUMS.sig) is a valid signature of data by a trusted key."""
    try:
        signature = base64.b64decode(signature_text.strip(), validate=True)
    except (binascii.Error, ValueError):
        return False
    for key in PUBLIC_KEYS if keys is None else keys:
        try:
            Ed25519PublicKey.from_public_bytes(base64.b64decode(key)).verify(signature, data)
            return True
        except (InvalidSignature, ValueError, binascii.Error):
            continue
    return False
