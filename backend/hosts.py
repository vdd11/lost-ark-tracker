"""Only answer requests addressed to this computer (DNS rebinding protection).

The server has no login: anything that can reach it can read the roster and
download backups. Binding to 127.0.0.1 keeps other machines out, but a web
page can still point its own domain at 127.0.0.1 ("DNS rebinding") and then
read our responses as if they were same-origin. Its requests carry that
domain in the Host header, so refusing any Host that isn't a loopback name
stops it. Ports don't matter (dev server, --port, the smoke test).

Starlette's TrustedHostMiddleware isn't used because it splits the Host header
on the first ":", which breaks IPv6 hosts like "[::1]:8777".
"""

from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Receive, Scope, Send

ALLOWED_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})


def host_name(header: str) -> str:
    """The host part of a Host header, without the port or IPv6 brackets."""
    header = header.strip().lower()
    if header.startswith("["):
        return header[1 : header.find("]")] if "]" in header else ""
    return header.rsplit(":", 1)[0] if header.count(":") == 1 else header


def is_allowed_host(header: str) -> bool:
    return host_name(header).rstrip(".") in ALLOWED_HOSTS


class LocalHostOnlyMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http":  # the app has no websockets
            headers = dict(scope["headers"])
            host = headers.get(b"host", b"").decode("latin-1")
            if not is_allowed_host(host):
                response = PlainTextResponse("Invalid host header", status_code=400)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
