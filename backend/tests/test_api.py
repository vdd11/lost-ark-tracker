from datetime import datetime


def task_named(client, name):
    return next(t for t in client.get("/tasks").json() if t["name"] == name)


def test_default_tasks_are_seeded(client):
    tasks = client.get("/tasks").json()
    assert {t["category"] for t in tasks} == {"daily", "weekly", "raid"}


def test_new_character_gets_dailies_and_weeklies_but_not_raids(client):
    character = client.post("/characters", json={"name": "Alt", "class_name": "Bard"}).json()
    categories = {t["id"]: t["category"] for t in client.get("/tasks").json()}
    assigned = {categories[task_id] for task_id in character["task_ids"]}
    assert assigned == {"daily", "weekly"}


def test_reserved_for_blank_is_stored_as_null(client):
    character = client.post(
        "/characters", json={"name": "Alt", "class_name": "Bard", "reserved_for": ""}
    ).json()
    assert character["reserved_for"] is None

    updated = client.patch(f"/characters/{character['id']}", json={"reserved_for": "Sam"}).json()
    assert updated["reserved_for"] == "Sam"


def test_completions_reset_on_schedule(client, set_now):
    character = client.post("/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    daily = task_named(client, "Chaos Dungeon")
    raid = task_named(client, "Aegir")

    set_now(datetime(2026, 10, 2, 12))  # Friday
    for task in (daily, raid):
        client.put(f"/characters/{character['id']}/tasks/{task['id']}/completion")
    completed = client.get("/tracker").json()["completed"]
    assert sorted(completed) == sorted([[character["id"], daily["id"]], [character["id"], raid["id"]]])

    set_now(datetime(2026, 10, 3, 12))  # next day: daily reset, raid still done
    assert client.get("/tracker").json()["completed"] == [[character["id"], raid["id"]]]

    set_now(datetime(2026, 10, 7, 10))  # Wednesday reset: everything clear
    assert client.get("/tracker").json()["completed"] == []


def test_uncomplete(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    character = client.post("/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    raid = task_named(client, "Aegir")
    url = f"/characters/{character['id']}/tasks/{raid['id']}/completion"

    client.put(url)
    client.put(url)  # idempotent
    client.delete(url)
    assert client.get("/tracker").json()["completed"] == []


def test_weekly_gold_combines_raids_and_logged_gold(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    earner = client.post("/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    friend_alt = client.post(
        "/characters",
        json={"name": "Spare", "class_name": "Bard", "is_gold_earner": False, "reserved_for": "Sam"},
    ).json()
    raid = task_named(client, "Aegir")
    client.patch(f"/tasks/{raid['id']}", json={"gold": 20000})

    for character in (earner, friend_alt):
        client.put(f"/characters/{character['id']}/tasks/{raid['id']}/completion")
    client.post("/gold-entries", json={"source": "Field Boss", "amount": 1500})
    client.post("/gold-entries", json={"source": "Chaos Gate", "amount": 1000, "character_id": earner["id"]})
    # Last week's entry lands in the previous bucket.
    client.post("/gold-entries", json={"source": "Field Boss", "amount": 700, "earned_at": "2026-09-29T12:00:00Z"})

    weeks = client.get("/gold/weekly?weeks=2").json()
    assert [w["week"] for w in weeks] == ["2026-09-23", "2026-09-30"]
    assert weeks[0]["total"] == 700
    assert weeks[1] == {
        "week": "2026-09-30",
        "raid_gold": 20000,  # the non-gold-earner's clear doesn't count
        "other_gold": 2500,
        "total": 22500,
        "by_source": {"Field Boss": 1500, "Chaos Gate": 1000},
    }

    # Changing the raid's gold later doesn't rewrite history.
    client.patch(f"/tasks/{raid['id']}", json={"gold": 99999})
    assert client.get("/gold/weekly?weeks=1").json()[0]["raid_gold"] == 20000


def test_deleting_character_keeps_gold_history(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    character = client.post("/characters", json={"name": "Main", "class_name": "Sorceress"}).json()
    raid = task_named(client, "Aegir")
    client.patch(f"/tasks/{raid['id']}", json={"gold": 5000})
    client.put(f"/characters/{character['id']}/tasks/{raid['id']}/completion")

    assert client.delete(f"/characters/{character['id']}").status_code == 204
    assert client.delete(f"/characters/{character['id']}").status_code == 404
    assert client.get("/gold/weekly?weeks=1").json()[0]["raid_gold"] == 5000
    assert client.get("/tracker").json()["completed"] == []
