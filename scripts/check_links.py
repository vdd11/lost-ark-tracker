"""Check the Guides page's built-in links (frontend/lib/data/guides.json).

    python scripts/check_links.py
    python scripts/check_links.py --report links-report.md

Requests each link like a browser would and sorts the result into:
- ok:            it answered (2xx/3xx) on the same site;
- unverifiable:  403 / 429 / 401 or a timeout: the site blocks bots or rate
                 limits, which says nothing about whether it's up;
- moved:         it ended up on a different site (a domain that lapsed and
                 was taken over still answers 200, so this matters);
- dead:          404 / 410 / 5xx, DNS failure or a refused connection.

Exits 1 only for moved or dead links, and 2 when every link failed the same
way (a problem on this machine, like missing certificates, not the sites). Not part of the normal checks: other
sites being down shouldn't fail CI. A weekly workflow (links.yml) runs it and
opens an issue when something is wrong. Standard library only.
"""

import argparse
import json
import socket
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

GUIDES = Path(__file__).resolve().parents[1] / "frontend" / "lib" / "data" / "guides.json"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0 Safari/537.36"
)
UNVERIFIABLE_STATUSES = {401, 403, 429}
FAILURES = {"moved", "dead"}


def ssl_context() -> ssl.SSLContext:
    """certifi's certificates when installed (some Windows Pythons can't read
    the system store), else the system's."""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def load_links(path: Path = GUIDES) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["guides"]


def site(url: str) -> str:
    """The registrable part of a host, roughly: "lostark.meta-game.gg" -> "meta-game.gg"."""
    host = (urlsplit(url).hostname or "").lower().removeprefix("www.")
    return ".".join(host.split(".")[-2:])


def classify(url: str, status: int | None, final_url: str | None, error: str | None = None) -> str:
    """ok, unverifiable, moved or dead for one request's outcome."""
    if status is None:
        if error and ("timed out" in error or "timeout" in error.lower()):
            return "unverifiable"
        return "dead"
    if status in UNVERIFIABLE_STATUSES:
        return "unverifiable"
    if status >= 400:
        return "dead"
    if final_url and site(final_url) != site(url):
        return "moved"
    return "ok"


def fetch(url: str, timeout: float = 20) -> tuple[int | None, str | None, str | None]:
    """(status, final URL after redirects, error) for a GET of url."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=ssl_context()) as response:
            return response.status, response.geturl(), None
    except urllib.error.HTTPError as error:
        return error.code, error.geturl(), None
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as error:
        reason = getattr(error, "reason", error)
        return None, None, str(reason)


def check(links: list[dict]) -> list[dict]:
    results = []
    for link in links:
        status, final_url, error = fetch(link["url"])
        results.append({
            **link,
            "status": status,
            "final_url": final_url,
            "error": error,
            "result": classify(link["url"], status, final_url, error),
        })
    return results


def checker_broken(results: list[dict]) -> bool:
    """Every link failed with the same error: the problem is here, not there."""
    errors = {r["error"] for r in results}
    return len(results) > 1 and all(r["status"] is None for r in results) and len(errors) == 1


def report(results: list[dict]) -> str:
    problems = [r for r in results if r["result"] in FAILURES]
    unverifiable = [r for r in results if r["result"] == "unverifiable"]
    lines = [f"Checked {len(results)} links: {len(problems)} need attention, {len(unverifiable)} couldn't be verified.", ""]
    for r in problems:
        detail = f"now goes to {r['final_url']}" if r["result"] == "moved" else (f"HTTP {r['status']}" if r["status"] else r["error"])
        lines.append(f"- **{r['result']}**: {r['title']} ({r['url']}): {detail}")
    for r in unverifiable:
        why = f"HTTP {r['status']}" if r["status"] else r["error"]
        lines.append(f"- unverifiable: {r['title']} ({r['url']}): {why}")
    if problems:
        lines += ["", "Fix or remove them in `frontend/lib/data/guides.json`, and update its `checked` date."]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--report", type=Path, help="also write the report (Markdown) to this file")
    args = parser.parse_args()
    results = check(load_links())
    if checker_broken(results):
        print(f"Every link failed with the same error, so the problem is on this machine: {results[0]['error']}")
        return 2
    text = report(results)
    print(text)
    if args.report:
        args.report.write_text(text + "\n", encoding="utf-8")
    return 1 if any(r["result"] in FAILURES for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
