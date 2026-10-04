from datetime import datetime


def task_named(client, name):
    return next(t for t in client.get("/api/tasks").json() if t["name"] == name)


def custom_raid(client):
    """A user-added raid without difficulties, paying the task's own gold."""
    return client.post("/api/tasks", json={"name": "Custom Raid", "category": "raid"}).json()


def test_default_tasks_are_seeded(client):
    tasks = client.get("/api/tasks").json()
    assert {t["category"] for t in tasks} == {"daily", "weekly", "raid"}


def test_new_character_gets_dailies_and_weeklies_but_not_raids(client):
    character = client.post("/api/characters", json={"name": "Alt", "class_name": "Bard"}).json()
    categories = {t["id"]: t["category"] for t in client.get("/api/tasks").json()}
    assigned = {categories[task_id] for task_id in character["task_ids"]}
    assert assigned == {"daily", "weekly"}


def test_completions_reset_on_schedule(client, set_now):
    character = client.post("/api/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    daily = task_named(client, "Chaos Dungeon")
    raid = custom_raid(client)

    set_now(datetime(2026, 10, 2, 12))  # Friday
    for task in (daily, raid):
        client.put(f"/api/characters/{character['id']}/tasks/{task['id']}/completion")
    completed = client.get("/api/tracker").json()["completed"]
    assert sorted(completed) == sorted([[character["id"], daily["id"]], [character["id"], raid["id"]]])

    set_now(datetime(2026, 10, 3, 12))  # next day: daily reset, raid still done
    assert client.get("/api/tracker").json()["completed"] == [[character["id"], raid["id"]]]

    set_now(datetime(2026, 10, 7, 10))  # Wednesday reset: everything clear
    assert client.get("/api/tracker").json()["completed"] == []


def test_uncomplete(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    character = client.post("/api/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    raid = custom_raid(client)
    url = f"/characters/{character['id']}/tasks/{raid['id']}/completion"

    client.put(url)
    client.put(url)  # idempotent
    client.delete(url)
    assert client.get("/api/tracker").json()["completed"] == []


def test_weekly_gold_combines_raids_and_logged_gold(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    earner = client.post("/api/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    friend_alt = client.post(
        "/api/characters",
        json={"name": "Spare", "class_name": "Bard", "is_gold_earner": False},
    ).json()
    raid = custom_raid(client)
    client.patch(f"/api/tasks/{raid['id']}", json={"gold": 20000})

    for character in (earner, friend_alt):
        client.put(f"/api/characters/{character['id']}/tasks/{raid['id']}/completion")
    client.post("/api/gold-entries", json={"source": "Field Boss", "amount": 1500})
    client.post("/api/gold-entries", json={"source": "Chaos Gate", "amount": 1000, "character_id": earner["id"]})
    # Last week's entry lands in the previous bucket.
    client.post("/api/gold-entries", json={"source": "Field Boss", "amount": 700, "earned_at": "2026-09-29T12:00:00Z"})

    weeks = client.get("/api/gold/weekly?weeks=2").json()
    assert [w["week"] for w in weeks] == ["2026-09-23", "2026-09-30"]
    assert weeks[0]["total"] == 700
    assert weeks[1] == {
        "week": "2026-09-30",
        "raid_gold": 20000,  # the non-gold-earner's clear doesn't count
        "other_gold": 2500,
        "total": 22500,
        "bound_gold": 0,
        "character_bound_gold": 0,
        "bonus_spent": 0,
        "net": 22500,
        "tradeable_left": 22500,
        "roster_bound_left": 0,
        "character_bound_left": 0,
        "character_bound": {},
        "untracked_spent": None,
        "by_source": {"Field Boss": 1500, "Chaos Gate": 1000},
        # The friend's alt cleared too but isn't a gold earner, so it's absent.
        "by_character": {"Main": 21000, "Unassigned": 1500},
    }

    # Changing the raid's gold later doesn't rewrite history.
    client.patch(f"/api/tasks/{raid['id']}", json={"gold": 99999})
    assert client.get("/api/gold/weekly?weeks=1").json()[0]["raid_gold"] == 20000


def test_deleting_character_keeps_gold_history(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    character = client.post("/api/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    raid = custom_raid(client)
    client.patch(f"/api/tasks/{raid['id']}", json={"gold": 5000})
    client.put(f"/api/characters/{character['id']}/tasks/{raid['id']}/completion")

    assert client.delete(f"/api/characters/{character['id']}").status_code == 204
    assert client.delete(f"/api/characters/{character['id']}").status_code == 404
    assert client.get("/api/gold/weekly?weeks=1").json()[0]["raid_gold"] == 5000
    assert client.get("/api/tracker").json()["completed"] == []


def test_backup_round_trip(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    character = client.post("/api/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    raid = custom_raid(client)
    client.patch(f"/api/tasks/{raid['id']}", json={"gold": 5000})
    client.put(f"/api/characters/{character['id']}/tasks/{raid['id']}")
    client.put(f"/api/characters/{character['id']}/tasks/{raid['id']}/completion")
    client.post("/api/gold-entries", json={"source": "Field Boss", "amount": 1500})

    backup = client.get("/api/backup").json()
    snapshot = {path: client.get(path).json() for path in ["/api/characters", "/api/tasks", "/api/tracker", "/api/gold/weekly?weeks=1"]}

    client.delete(f"/api/characters/{character['id']}")
    client.post("/api/characters", json={"name": "Other", "class_name": "Bard"})

    assert client.post("/api/backup", json=backup).status_code == 204
    for path, expected in snapshot.items():
        assert client.get(path).json() == expected


def test_restore_rejects_other_files_without_touching_data(client):
    client.post("/api/characters", json={"name": "Main", "class_name": "Sorceress"})

    assert client.post("/api/backup", json={"hello": "world"}).status_code == 400
    bad = client.get("/api/backup").json()
    bad["completions"] = [{"period": "not a date", "completed_at": "2026-10-02T12:00:00"}]
    assert client.post("/api/backup", json=bad).status_code == 400

    assert [c["name"] for c in client.get("/api/characters").json()] == ["Main"]


def test_guild_weekly_is_removed_once_on_upgrade(client):
    from fastapi.testclient import TestClient
    from sqlalchemy import text

    import main
    from database import engine

    assert all(t["name"] != "Guild Weekly" for t in client.get("/api/tasks").json())

    # A database from before the removal still has it...
    client.post("/api/tasks", json={"name": "Guild Weekly", "category": "weekly"})
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM applied_migrations"))
    with TestClient(main.app, base_url="http://127.0.0.1") as restarted:
        assert all(t["name"] != "Guild Weekly" for t in restarted.get("/api/tasks").json())

    # ...but one added back afterwards on purpose stays.
    client.post("/api/tasks", json={"name": "Guild Weekly", "category": "weekly"})
    with TestClient(main.app, base_url="http://127.0.0.1") as restarted:
        assert any(t["name"] == "Guild Weekly" for t in restarted.get("/api/tasks").json())


def test_root_reports_version_and_platform(client):
    info = client.get("/api/").json()
    assert info["app"] == "Lost Ark Tracker"
    assert info["platform"] in {"windows", "macos", "linux"}
