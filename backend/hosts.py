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


# Cross-site writes ("CSRF"). The Host check above stops a page from reading
# our answers, but any web page can still *send* a simple cross-site POST to
# http://127.0.0.1:<port> (a form, or fetch with no body: no preflight), and
# endpoints like POST /api/update/install or a restore act on it. Browsers say
# where such a request came from, so state-changing requests from another
# site are refused. Non-browser clients (curl, the smoke test, scripts) send
# neither header and pass.

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
# The Next.js dev server and the API's dev port, besides the app's own origin.
DEV_PORTS = frozenset({3000, 8000})


def port_of(netloc: str, scheme: str) -> int | None:
    netloc = netloc.strip().lower()
    tail = netloc.rsplit("]", 1)[-1] if netloc.startswith("[") else netloc
    if ":" in tail:
        try:
            return int(tail.rsplit(":", 1)[1])
        except ValueError:
            return None
    return 443 if scheme == "https" else 80


def is_allowed_origin(origin: str, host_header: str) -> bool:
    """An Origin header is fine when it's this computer, on the app's own port or a dev port."""
    if "://" not in origin:
        return False  # includes the opaque "null" origin (sandboxed frames, file://)
    scheme, _, netloc = origin.partition("://")
    if scheme not in ("http", "https") or not is_allowed_host(netloc):
        return False
    port = port_of(netloc, scheme)
    return port is not None and (port == port_of(host_header, "http") or port in DEV_PORTS)


def is_allowed_write(origin: str | None, fetch_site: str | None, host_header: str) -> bool:
    if origin is not None:
        return is_allowed_origin(origin, host_header)
    if fetch_site is not None:
        return fetch_site in ("same-origin", "same-site", "none")
    return True  # not a browser


class SameOriginWritesMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "http" and scope["method"] in WRITE_METHODS:
            headers = dict(scope["headers"])
            origin = headers.get(b"origin")
            fetch_site = headers.get(b"sec-fetch-site")
            host = headers.get(b"host", b"").decode("latin-1")
            if not is_allowed_write(
                origin.decode("latin-1") if origin is not None else None,
                fetch_site.decode("latin-1").lower() if fetch_site is not None else None,
                host,
            ):
                response = PlainTextResponse("Cross-site request refused", status_code=403)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
