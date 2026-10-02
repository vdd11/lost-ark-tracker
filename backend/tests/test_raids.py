from dataclasses import replace
from datetime import datetime

import raids
from database import SessionLocal
from models import CharacterTask, RaidDifficulty, Task


def raid_named(client, name, include_archived=False):
    tasks = client.get(f"/api/tasks?include_archived={str(include_archived).lower()}").json()
    return next(t for t in tasks if t["name"] == name)


def difficulty(raid, name):
    return next(d for d in raid["difficulties"] if d["name"] == name)


def add_character(client, item_level=1725, raids_=(), **extra):
    return client.post("/api/characters", json={
        "name": "Main", "class_name": "Sorceress", "item_level": item_level, "raids": list(raids_), **extra,
    }).json()


def test_catalog_is_seeded_with_difficulties(client):
    act4 = raid_named(client, "Act 4: Fortress of Destruction")
    assert [(d["name"], d["min_item_level"], d["gold"]) for d in act4["difficulties"]] == [
        ("Solo", 1700, 27000), ("Normal", 1700, 27000), ("Hard", 1720, 38000),
    ]
    # Unconfirmed gold stays unknown rather than guessed.
    assert difficulty(raid_named(client, "Act 1: Aegir"), "Normal")["gold"] is None
    assert raid_named(client, "Act 3 Extreme")["gold_for_everyone"] is True


def test_new_character_picks_raids_with_best_difficulty_for_item_level(client):
    act4 = raid_named(client, "Act 4: Fortress of Destruction")
    final = raid_named(client, "Denouement: The Final Day")
    serca = raid_named(client, "Shadow Raid: Serca")

    character = add_character(client, 1725, [
        {"task_id": act4["id"]},
        {"task_id": final["id"]},
        {"task_id": serca["id"], "difficulty_id": difficulty(serca, "Normal")["id"]},
    ])

    assert character["difficulty_ids"] == {
        str(act4["id"]): difficulty(act4, "Hard")["id"],         # 1725 >= 1720
        str(final["id"]): difficulty(final, "Normal")["id"],     # 1725 < 1730 for Hard
        str(serca["id"]): difficulty(serca, "Normal")["id"],     # chosen explicitly
    }
    assert {act4["id"], final["id"], serca["id"]} <= set(character["task_ids"])


def test_rejects_difficulty_from_another_raid(client):
    act4 = raid_named(client, "Act 4: Fortress of Destruction")
    serca = raid_named(client, "Shadow Raid: Serca")
    response = client.post("/api/characters", json={
        "name": "Main", "class_name": "Bard",
        "raids": [{"task_id": act4["id"], "difficulty_id": difficulty(serca, "Hard")["id"]}],
    })
    assert response.status_code == 400


def test_changing_difficulty_on_the_tracker(client):
    act4 = raid_named(client, "Act 4: Fortress of Destruction")
    character = add_character(client, 1725, [{"task_id": act4["id"]}])
    normal = difficulty(act4, "Normal")["id"]

    client.put(f"/api/characters/{character['id']}/tasks/{act4['id']}", json={"difficulty_id": normal})
    updated = next(c for c in client.get("/api/characters").json() if c["id"] == character["id"])
    assert updated["difficulty_ids"][str(act4["id"])] == normal


def test_gold_uses_difficulty_and_weekly_cap(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    picks = ["Act 4: Fortress of Destruction", "Denouement: The Final Day", "Shadow Raid: Serca", "Act 3: Mordum"]
    tasks = [raid_named(client, name) for name in picks]
    character = add_character(client, 1735, [{"task_id": t["id"]} for t in tasks])
    mordum = tasks[3]
    client.patch(f"/api/difficulties/{difficulty(mordum, 'Hard')['id']}", json={"gold": 30000})

    for task in tasks:
        client.put(f"/api/characters/{character['id']}/tasks/{task['id']}/completion")

    # Act 4 Hard 38,000 + Denouement Hard 48,000 + Serca Hard (unknown -> 0)...
    # Serca pays nothing, so it doesn't use a gold slot; Mordum Hard is the third.
    week = client.get("/api/gold/weekly?weeks=1").json()[0]
    assert week["raid_gold"] == 38000 + 48000 + 30000


def test_fourth_paid_raid_pays_nothing(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    names = ["Act 4: Fortress of Destruction", "Denouement: The Final Day", "Act 2: Brelshaza", "Act 3: Mordum"]
    tasks = [raid_named(client, name) for name in names]
    for task in tasks:
        for d in task["difficulties"]:
            if d["gold"] is None:
                client.patch(f"/api/difficulties/{d['id']}", json={"gold": 10000})
    character = add_character(client, 1735, [{"task_id": t["id"]} for t in tasks])

    for task in tasks:
        client.put(f"/api/characters/{character['id']}/tasks/{task['id']}/completion")

    assert client.get("/api/gold/weekly?weeks=1").json()[0]["raid_gold"] == 38000 + 48000 + 10000


def test_extreme_raid_pays_non_earners_outside_the_cap(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    extreme = raid_named(client, "Act 3 Extreme")
    character = add_character(client, 1735, [{"task_id": extreme["id"]}], is_gold_earner=False)

    client.put(f"/api/characters/{character['id']}/tasks/{extreme['id']}/completion")
    assert client.get("/api/gold/weekly?weeks=1").json()[0]["raid_gold"] == 20000


def test_catalog_updates_reach_unedited_values_only(client, monkeypatch):
    act4 = raid_named(client, "Act 4: Fortress of Destruction")
    client.patch(f"/api/difficulties/{difficulty(act4, 'Normal')['id']}", json={"gold": 11111})

    patched = [
        replace(r, difficulties=[replace(d, gold=d.gold + 1000) for d in r.difficulties])
        if r.key == "kazeros-act-4" else r
        for r in raids.RAID_CATALOG
    ]
    monkeypatch.setattr(raids, "RAID_CATALOG", patched)
    with SessionLocal() as db:
        raids.sync_raid_catalog(db)

    act4 = raid_named(client, "Act 4: Fortress of Destruction")
    assert difficulty(act4, "Normal")["gold"] == 11111   # user's edit kept
    assert difficulty(act4, "Hard")["gold"] == 39000     # followed the catalog

    reset = client.post(f"/api/difficulties/{difficulty(act4, 'Normal')['id']}/reset").json()
    assert reset["gold"] == 28000


def test_deleting_catalog_raid_archives_it(client):
    serca = raid_named(client, "Shadow Raid: Serca")
    character = add_character(client, 1725, [{"task_id": serca["id"]}])

    assert client.delete(f"/api/tasks/{serca['id']}").status_code == 204
    with SessionLocal() as db:
        raids.sync_raid_catalog(db)

    assert all(t["name"] != "Shadow Raid: Serca" for t in client.get("/api/tasks").json())
    assert raid_named(client, "Shadow Raid: Serca", include_archived=True)["archived"] is True
    assert serca["id"] not in client.get("/api/characters").json()[0]["task_ids"]
    assert character["id"]

    client.patch(f"/api/tasks/{serca['id']}", json={"archived": False})
    assert raid_named(client, "Shadow Raid: Serca")["archived"] is False


def test_old_raid_columns_are_adopted_by_the_catalog(client):
    character = add_character(client, 1685)

    # Recreate what v1.x left behind: a plain "Aegir" raid column, assigned.
    with SessionLocal() as db:
        act1 = db.query(Task).filter_by(catalog_key="kazeros-act-1").one()
        db.query(RaidDifficulty).filter_by(task_id=act1.id).delete()
        db.delete(act1)
        legacy = Task(name="Aegir", category="raid", gold=23000, position=99)
        db.add(legacy)
        db.flush()
        db.add(CharacterTask(character_id=character["id"], task_id=legacy.id))
        db.commit()
        legacy_id = legacy.id

        raids.sync_raid_catalog(db)

    act1 = raid_named(client, "Act 1: Aegir")
    assert act1["id"] == legacy_id
    updated = client.get("/api/characters").json()[0]
    assert updated["difficulty_ids"][str(legacy_id)] == difficulty(act1, "Hard")["id"]  # 1685 >= 1680
