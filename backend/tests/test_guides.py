"""Guides page: the user's own links and hidden built-in links."""

import pytest


def add(client, **body):
    response = client.post("/api/guides/links", json={"title": "Guild", "url": "https://discord.gg/abc", **body})
    assert response.status_code == 201, response.text
    return response.json()


def test_starts_empty(client):
    assert client.get("/api/guides").json() == {"links": [], "hidden": []}


def test_add_edit_and_delete_links(client):
    first = add(client, description="Our Discord")
    second = add(client, title="Creator", url="youtube.com/@someone", category="Videos")
    assert second["url"] == "https://youtube.com/@someone"
    assert [l["title"] for l in client.get("/api/guides").json()["links"]] == ["Guild", "Creator"]

    edited = client.patch(f"/api/guides/links/{first['id']}", json={"title": "Guild chat", "description": None}).json()
    assert (edited["title"], edited["description"], edited["url"]) == ("Guild chat", None, "https://discord.gg/abc")

    assert client.delete(f"/api/guides/links/{first['id']}").status_code == 204
    assert [l["id"] for l in client.get("/api/guides").json()["links"]] == [second["id"]]
    assert client.delete(f"/api/guides/links/{first['id']}").status_code == 404


@pytest.mark.parametrize(
    "url", ["javascript:alert(1)", "file:///C:/Windows", "ftp://example.com", "not a url", "http://", "data:text/html,hi"]
)
def test_only_web_addresses_are_accepted(client, url):
    assert client.post("/api/guides/links", json={"title": "x", "url": url}).status_code == 422
    link = add(client)
    assert client.patch(f"/api/guides/links/{link['id']}", json={"url": url}).status_code == 422


def test_hide_and_reset_built_in_links(client):
    for guide_id in ("maxroll", "reddit", "maxroll"):
        assert client.put(f"/api/guides/hidden/{guide_id}").status_code == 204
    assert client.get("/api/guides").json()["hidden"] == ["maxroll", "reddit"]
    client.delete("/api/guides/hidden/reddit")
    assert client.get("/api/guides").json()["hidden"] == ["maxroll"]
    client.delete("/api/guides/hidden")
    assert client.get("/api/guides").json()["hidden"] == []


def test_links_and_hidden_survive_a_backup(client):
    add(client)
    client.put("/api/guides/hidden/maxroll")
    backup = client.get("/api/backup").json()
    client.delete("/api/guides/hidden")
    assert client.post("/api/backup", json=backup).status_code == 204
    restored = client.get("/api/guides").json()
    assert restored["hidden"] == ["maxroll"] and restored["links"][0]["title"] == "Guild"
