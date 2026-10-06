"""Azena's and Innana's blessings on characters."""


def make_character(client, **extra):
    response = client.post("/api/characters", json={"name": "Main", "class_name": "Bard", "item_level": 1740, **extra})
    assert response.status_code == 201
    return response.json()


def test_blessings_are_set_refreshed_and_cleared(client):
    character = make_character(client)
    assert character["azena_until"] is None and character["innana_until"] is None

    url = f"/api/characters/{character['id']}"
    updated = client.patch(url, json={"azena_until": "2026-11-05", "innana_until": "2026-10-20"}).json()
    assert (updated["azena_until"], updated["innana_until"]) == ("2026-11-05", "2026-10-20")

    # Renewing moves the end date; other edits leave blessings alone.
    assert client.patch(url, json={"innana_until": "2026-11-19"}).json()["innana_until"] == "2026-11-19"
    assert client.patch(url, json={"item_level": 1745}).json()["azena_until"] == "2026-11-05"

    cleared = client.patch(url, json={"azena_until": None}).json()
    assert cleared["azena_until"] is None and cleared["innana_until"] == "2026-11-19"


def test_blessings_survive_a_backup(client):
    character = make_character(client)
    client.patch(f"/api/characters/{character['id']}", json={"azena_until": "2026-11-05"})
    backup = client.get("/api/backup").json()
    assert client.post("/api/backup", json=backup).status_code == 204
    restored = client.get("/api/characters").json()[0]
    assert restored["azena_until"] == "2026-11-05" and restored["innana_until"] is None


def test_a_daily_keeps_its_run_count(client):
    """Innana's second Chaos Dungeon run is the completion's count (the app decides when it's done)."""
    character = make_character(client)
    chaos = next(t for t in client.get("/api/tasks").json() if t["name"] == "Chaos Dungeon")
    path = f"/api/characters/{character['id']}/tasks/{chaos['id']}/completion"

    def runs():
        found = [r for r in client.get("/api/tracker").json()["runs"] if r["task_id"] == chaos["id"]]
        return found[0]["count"] if found else 0

    assert client.put(path, json={"count": 1}).status_code == 204
    assert runs() == 1
    assert client.put(path, json={"count": 2}).status_code == 204
    assert runs() == 2
    assert client.delete(path).status_code == 204
    assert runs() == 0


def test_embers_are_logged_per_day_and_summed_for_the_week(client, set_now):
    from datetime import datetime

    character = make_character(client)
    tasks = {t["name"]: t for t in client.get("/api/tasks").json()}
    path = lambda name: f"/api/characters/{character['id']}/tasks/{tasks[name]['id']}/completion"  # noqa: E731

    set_now(datetime(2026, 10, 8, 12))  # Thursday
    assert client.put(path("Chaos Dungeon"), json={"fate_embers": 2}).status_code == 204
    set_now(datetime(2026, 10, 9, 12))  # Friday
    client.put(path("Chaos Dungeon"), json={})
    client.put(path("Chaos Dungeon"), json={"fate_embers": 1, "blessed_embers": 1})
    client.put(path("Guardian Raid"), json={"blessed_embers": 3})

    tracker = client.get("/api/tracker").json()
    today = {r["task_id"]: r for r in tracker["runs"]}
    assert (today[tasks["Chaos Dungeon"]["id"]]["fate_embers"], today[tasks["Chaos Dungeon"]["id"]]["blessed_embers"]) == (1, 1)
    assert tracker["embers"] == [{"character_id": character["id"], "fate": 3, "blessed": 4}]

    # A new week starts from zero.
    set_now(datetime(2026, 10, 14, 12))
    assert client.get("/api/tracker").json()["embers"] == []
    assert client.put(path("Chaos Dungeon"), json={"fate_embers": -1}).status_code == 422
