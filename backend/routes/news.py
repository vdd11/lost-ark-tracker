"""Official news and server status for the tracker's news widget."""

from fastapi import APIRouter

import news
from schemas import NewsFeed

router = APIRouter(prefix="/api")


@router.get("/news", response_model=NewsFeed)
def get_news():
    """Each half is fetched on its own, so one site being down doesn't hide the other."""
    feed = NewsFeed()
    try:
        feed.servers = news.server_status()
    except Exception:
        feed.servers_error = "Couldn't reach the Lost Ark server status page."
    try:
        feed.news = news.steam_news()
    except Exception:
        feed.news_error = "Couldn't load the latest news."
    return feed
