"""Official Lost Ark news and server status, fetched from public pages and
cached briefly so the tracker can show them without hammering anyone."""

import html
import json
import re
import ssl
import time
import urllib.request
from datetime import datetime, timezone

import certifi

STATUS_URL = "https://www.playlostark.com/en-us/support/server-status"
STEAM_APP_ID = 1599340
STEAM_NEWS_URL = (
    "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/"
    f"?appid={STEAM_APP_ID}&count=12&maxlength=240&feeds=steam_community_announcements"
)
CACHE_SECONDS = 600
TIMEOUT_SECONDS = 8

_cache: dict[str, tuple[float, object]] = {}
# certifi's certificates, not the Windows store, which can't always be read.
_ssl = ssl.create_default_context(cafile=certifi.where())


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (LostArkTracker)"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=_ssl) as response:
        return response.read().decode("utf-8", errors="replace")


def cached(key: str, load):
    """Return a fresh-enough cached value, else load it. A failed load falls
    back to the last good value if there is one."""
    now = time.monotonic()
    hit = _cache.get(key)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]
    try:
        value = load()
    except Exception:
        if hit:
            return hit[1]
        raise
    _cache[key] = (now, value)
    return value


_REGION = re.compile(r'role="tabpanel"[^>]*id="([^"]+)"|id="([^"]+)"[^>]*role="tabpanel"')
_SERVER = re.compile(
    r"server-status--(\w+).*?server-name\">\s*([^<]+?)\s*</div>",
    re.DOTALL,
)


def parse_server_status(page: str) -> list[dict]:
    """Servers per region from the official status page: name and one of
    good / busy / full / maintenance (as the page labels them)."""
    servers = []
    regions = list(_REGION.finditer(page))
    for index, match in enumerate(regions):
        region = html.unescape(match.group(1) or match.group(2))
        end = regions[index + 1].start() if index + 1 < len(regions) else len(page)
        for status, name in _SERVER.findall(page[match.end():end]):
            servers.append({"region": region, "name": html.unescape(name), "status": status})
    return servers


def parse_steam_news(data: str) -> list[dict]:
    items = json.loads(data).get("appnews", {}).get("newsitems", [])
    return [
        {
            "title": html.unescape(item.get("title", "")),
            "url": f"https://store.steampowered.com/news/app/{STEAM_APP_ID}/view/{item['gid']}",
            "date": datetime.fromtimestamp(item.get("date", 0), tz=timezone.utc).isoformat(),
        }
        for item in items
        if item.get("gid")
    ]


def server_status() -> list[dict]:
    return cached("status", lambda: parse_server_status(fetch_text(STATUS_URL)))


def steam_news() -> list[dict]:
    return cached("news", lambda: parse_steam_news(fetch_text(STEAM_NEWS_URL)))
