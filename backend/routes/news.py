"""Official news and server status for the tracker's news widget."""

from fastapi import APIRouter

import news
from schemas import NewsFeed

router = APIRouter(prefix="/api")


@router.get("/news", response_model=NewsFeed)
def get_news():
    """Each half is fetched on its own, so one site being down doesn't hide the other."""
    parts: dict = {}
    try:
        parts["servers"] = news.server_status()
    except Exception:
        parts["servers_error"] = "Couldn't reach the Lost Ark server status page."
    try:
        parts["news"] = news.steam_news()
    except Exception:
        parts["news_error"] = "Couldn't load the latest news."
    # Built at the end so the parsed dicts are validated into the schema's models.
    return NewsFeed(**parts)
