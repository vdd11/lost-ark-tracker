import json

import news

STATUS_PAGE = """
<div id="North America" role="tabpanel" class="ags-ServerStatus-content-responses-response">
  <div class="ags-ServerStatus-content-responses-response-server">
    <div class="ags-ServerStatus-content-responses-response-server-status ags-ServerStatus-content-responses-response-server-status--good"><svg></svg></div>
    <div aria-label="Vairgrys is online" class="ags-ServerStatus-content-responses-response-server-name"> Vairgrys </div>
  </div>
  <div class="ags-ServerStatus-content-responses-response-server">
    <div class="ags-ServerStatus-content-responses-response-server-status ags-ServerStatus-content-responses-response-server-status--maintenance"></div>
    <div class="ags-ServerStatus-content-responses-response-server-name"> Brelshaza </div>
  </div>
</div>
<div id="Europe Central" role="tabpanel" class="ags-ServerStatus-content-responses-response">
  <div class="ags-ServerStatus-content-responses-response-server-status ags-ServerStatus-content-responses-response-server-status--busy"></div>
  <div class="ags-ServerStatus-content-responses-response-server-name"> Elpon </div>
</div>
"""


def test_parses_servers_per_region():
    assert news.parse_server_status(STATUS_PAGE) == [
        {"region": "North America", "name": "Vairgrys", "status": "good"},
        {"region": "North America", "name": "Brelshaza", "status": "maintenance"},
        {"region": "Europe Central", "name": "Elpon", "status": "busy"},
    ]


def test_parses_steam_announcements():
    data = json.dumps({"appnews": {"newsitems": [
        {"gid": "42", "title": "Patch &amp; notes", "date": 1789488861},
        {"title": "no id, skipped"},
    ]}})
    [item] = news.parse_steam_news(data)
    assert item["title"] == "Patch & notes"
    assert item["url"].endswith("/view/42")
    assert item["date"].startswith("2026-")


def test_news_endpoint_survives_a_site_being_down(client, monkeypatch):
    news._cache.clear()

    def fetch(url):
        if url == news.STATUS_URL:
            return STATUS_PAGE
        raise OSError("offline")

    monkeypatch.setattr(news, "fetch_text", fetch)
    feed = client.get("/api/news").json()
    assert len(feed["servers"]) == 3 and feed["servers_error"] is None
    assert feed["news"] == [] and feed["news_error"]
    news._cache.clear()
