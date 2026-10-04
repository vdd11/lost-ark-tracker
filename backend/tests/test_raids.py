from dataclasses import replace
from datetime import datetime, timedelta

import raids
from database import SessionLocal
from models import CharacterTask, RaidDifficulty, Task

NOW = datetime(2026, 10, 2, 12)


def task_named(client, name, include_archived=False):
    tasks = client.get(f"/api/tasks?include_archived={str(include_archived).lower()}").json()
    return next(t for t in tasks if t["name"] == name)


def difficulty(task, name):
    return next(d for d in task["difficulties"] if d["name"] == name)


def add_character(client, item_level=1775, raids_=(), **extra):
    return client.post("/api/characters", json={
        "name": extra.pop("name", "Main"), "class_name": "Sorceress", "item_level": item_level,
        "raids": list(raids_), **extra,
    }).json()


def character(client, character_id):
    return next(c for c in client.get("/api/characters").json() if c["id"] == character_id)


def complete(client, character_id, task_id, **body):
    return client.put(f"/api/characters/{character_id}/tasks/{task_id}/completion", json=body or None)


def raid_gold(client):
    return client.get("/api/gold/weekly?weeks=1").json()[0]["raid_gold"]


def test_catalog_has_the_raids_people_run(client):
    raids_ = {t["name"]: t for t in client.get("/api/tasks").json() if t["category"] == "raid"}
    assert set(raids_) == {"Serca", "Horizon Cathedral", "The Final Day", "Act 4"}
    assert [(d["name"], d["min_item_level"], d["gold"]) for d in raids_["Horizon Cathedral"]["difficulties"]] == [
        ("Lv1", 1700, 30000), ("Lv2", 1720, 40000), ("Lv3", 1750, 50000),
    ]
    assert [d["name"] for d in raids_["The Final Day"]["difficulties"]] == ["Normal", "Hard"]


def test_new_character_gets_best_difficulty_for_item_level(client):
    serca, cathedral, final = (task_named(client, n) for n in ["Serca", "Horizon Cathedral", "The Final Day"])

    sorc = add_character(client, 1775, [{"task_id": t["id"]} for t in (serca, cathedral, final)])
    # (The Ebony Cube unlock is in there too.)
    assert sorc["difficulty_ids"].items() >= {
        str(serca["id"]): difficulty(serca, "Nightmare")["id"],
        str(cathedral["id"]): difficulty(cathedral, "Lv3")["id"],
        str(final["id"]): difficulty(final, "Hard")["id"],
    }.items()

    alt = add_character(client, 1750, [{"task_id": t["id"]} for t in (serca, cathedral)], name="Alt")
    assert alt["difficulty_ids"][str(cathedral["id"])] == difficulty(cathedral, "Lv3")["id"]
    explicit = add_character(
        client, 1750, [{"task_id": serca["id"], "difficulty_id": difficulty(serca, "Hard")["id"]}], name="Alt2",
    )
    assert explicit["difficulty_ids"][str(serca["id"])] == difficulty(serca, "Hard")["id"]


def test_rejects_difficulty_from_another_raid(client):
    act4, serca = task_named(client, "Act 4"), task_named(client, "Serca")
    response = client.post("/api/characters", json={
        "name": "Main", "class_name": "Bard",
        "raids": [{"task_id": act4["id"], "difficulty_id": difficulty(serca, "Hard")["id"]}],
    })
    assert response.status_code == 400


def test_item_level_up_moves_to_the_next_tier_unless_chosen_by_hand(client):
    cathedral, serca = task_named(client, "Horizon Cathedral"), task_named(client, "Serca")
    alt = add_character(client, 1745, [
        {"task_id": cathedral["id"]},                                               # Lv2 (best)
        {"task_id": serca["id"], "difficulty_id": difficulty(serca, "Normal")["id"]},  # chosen
    ])

    client.patch(f"/api/characters/{alt['id']}", json={"item_level": 1752})
    updated = character(client, alt["id"])
    assert updated["difficulty_ids"][str(cathedral["id"])] == difficulty(cathedral, "Lv3")["id"]
    assert updated["difficulty_ids"][str(serca["id"])] == difficulty(serca, "Normal")["id"]


def test_three_raids_pay_and_an_extra_run_does_not(client, set_now):
    set_now(NOW)
    serca, cathedral, final, act4 = (
        task_named(client, n) for n in ["Serca", "Horizon Cathedral", "The Final Day", "Act 4"]
    )
    sorc = add_character(client, 1775, [{"task_id": t["id"]} for t in (serca, cathedral, final)])

    for task in (serca, cathedral, final):
        complete(client, sorc["id"], task["id"])
    # Act 4 isn't a usual raid for this character, but can still be checked.
    assert complete(client, sorc["id"], act4["id"], difficulty_id=difficulty(act4, "Normal")["id"]).status_code == 204

    assert raid_gold(client) == 54000 + 50000 + 48000
    runs = client.get("/api/tracker").json()["runs"]
    extra = next(r for r in runs if r["task_id"] == act4["id"])
    assert (extra["character_id"], extra["difficulty_id"]) == (sorc["id"], difficulty(act4, "Normal")["id"])


def test_extra_run_pays_when_a_slot_is_free(client, set_now):
    set_now(NOW)
    act4 = task_named(client, "Act 4")
    alt = add_character(client, 1725)

    complete(client, alt["id"], act4["id"])  # not assigned: best difficulty for 1725
    assert raid_gold(client) == 38000

    # Switching the difficulty after the fact re-prices the clear.
    complete(client, alt["id"], act4["id"], difficulty_id=difficulty(act4, "Normal")["id"])
    assert raid_gold(client) == 27000

    # Re-saving without a change keeps the recorded gold, even if the raid's value changed.
    client.patch(f"/api/difficulties/{difficulty(act4, 'Normal')['id']}", json={"gold": 99999})
    complete(client, alt["id"], act4["id"])
    assert raid_gold(client) == 27000


def test_event_raid_is_one_clear_per_roster_and_pays_anyone(client, set_now):
    set_now(NOW)
    template = client.get("/api/event-raids/template").json()
    assert "Act 3" in template["bases"]

    event = client.post("/api/event-raids", json={
        "name": "Act 3 Extreme", "ends_on": "2026-10-28", "difficulties": template["difficulties"],
    }).json()
    assert (event["roster_limited"], event["gold_for_everyone"]) == (True, True)

    friend_alt = add_character(client, 1755, [{"task_id": event["id"]}], is_gold_earner=False, name="Spare")
    main = add_character(client, 1775, [{"task_id": event["id"]}])

    assert complete(client, friend_alt["id"], event["id"]).status_code == 204
    assert raid_gold(client) == 45000  # Hard, paid despite not being a gold earner
    blocked = complete(client, main["id"], event["id"])
    assert blocked.status_code == 409 and "Spare" in blocked.json()["detail"]


def test_ebony_cube_counts_runs_at_the_characters_unlock(client, set_now):
    set_now(NOW)
    cube = task_named(client, "Ebony Cube")
    alt = add_character(client, 1705)
    assert cube["id"] in alt["task_ids"]
    assert alt["difficulty_ids"][str(cube["id"])] == difficulty(cube, "3rd")["id"]

    complete(client, alt["id"], cube["id"], count=3)
    run = next(r for r in client.get("/api/tracker").json()["runs"] if r["task_id"] == cube["id"])
    assert run["count"] == 3

    complete(client, alt["id"], cube["id"], count=0)
    assert all(r["task_id"] != cube["id"] for r in client.get("/api/tracker").json()["runs"])


def test_gems_are_summed_as_level_one_equivalents(client, set_now):
    set_now(NOW)
    client.post("/api/gem-entries", json={"source": "Ebony Cube", "gems": {"1": 3, "2": 1}})
    client.post("/api/gem-entries", json={"source": "Field Boss", "gems": {"3": 1}})
    client.post("/api/gem-entries", json={"source": "Guardian Raid", "gems": {"1": 2}, "earned_at": "2026-09-29T12:00:00Z"})
    assert client.post("/api/gem-entries", json={"source": "Field Boss", "gems": {"1": 0}}).status_code == 400
    assert client.post("/api/gem-entries", json={"source": "Field Boss", "gems": {"11": 1}}).status_code == 422

    last_week, this_week = client.get("/api/gems/weekly?weeks=2").json()
    assert last_week["total"] == 2
    assert this_week == {
        "week": "2026-09-30",
        "total": 3 + 3 + 9,
        "by_source": {"Ebony Cube": 6, "Field Boss": 9},
        "by_level": {"1": 3, "2": 1, "3": 1},
        "by_character": {"Unassigned": 15},
    }


def test_catalog_updates_reach_unedited_values_only(client, monkeypatch):
    act4 = task_named(client, "Act 4")
    client.patch(f"/api/difficulties/{difficulty(act4, 'Normal')['id']}", json={"gold": 11111})

    patched = [
        replace(item, difficulties=[replace(d, gold=d.gold + 1000) for d in item.difficulties])
        if item.key == "kazeros-act-4" else item
        for item in raids.CATALOG
    ]
    monkeypatch.setattr(raids, "CATALOG", patched)
    with SessionLocal() as db:
        raids.sync_catalog(db)

    act4 = task_named(client, "Act 4")
    assert difficulty(act4, "Normal")["gold"] == 11111
    assert difficulty(act4, "Hard")["gold"] == 39000
    assert client.post(f"/api/difficulties/{difficulty(act4, 'Normal')['id']}/reset").json()["gold"] == 28000


def test_removed_difficulty_moves_characters_to_their_best(client, monkeypatch):
    final = task_named(client, "The Final Day")
    sorc = add_character(client, 1775, [{"task_id": final["id"], "difficulty_id": difficulty(final, "Normal")["id"]}])

    patched = [
        replace(item, difficulties=[d for d in item.difficulties if d.name != "Normal"])
        if item.key == "kazeros-denouement" else item
        for item in raids.CATALOG
    ]
    monkeypatch.setattr(raids, "CATALOG", patched)
    with SessionLocal() as db:
        raids.sync_catalog(db)

    final = task_named(client, "The Final Day")
    assert [d["name"] for d in final["difficulties"]] == ["Hard"]
    assert character(client, sorc["id"])["difficulty_ids"][str(final["id"])] == difficulty(final, "Hard")["id"]


def test_deleting_catalog_raid_hides_it(client):
    serca = task_named(client, "Serca")
    add_character(client, 1725, [{"task_id": serca["id"]}])

    assert client.delete(f"/api/tasks/{serca['id']}").status_code == 204
    with SessionLocal() as db:
        raids.sync_catalog(db)

    assert all(t["name"] != "Serca" for t in client.get("/api/tasks").json())
    assert serca["id"] not in client.get("/api/characters").json()[0]["task_ids"]
    client.patch(f"/api/tasks/{serca['id']}", json={"archived": False})
    assert task_named(client, "Serca")["archived"] is False


def test_old_columns_are_adopted_and_renamed(client):
    alt = add_character(client, 1725)

    # What earlier versions left behind: "Act 4: Armoche" (v1.x) assigned to a character.
    with SessionLocal() as db:
        act4 = db.query(Task).filter_by(catalog_key="kazeros-act-4").one()
        db.query(RaidDifficulty).filter_by(task_id=act4.id).delete()
        db.delete(act4)
        legacy = Task(name="Act 4: Armoche", category="raid", gold=33000, position=99)
        db.add(legacy)
        db.flush()
        db.add(CharacterTask(character_id=alt["id"], task_id=legacy.id))
        db.commit()
        legacy_id = legacy.id
        raids.sync_catalog(db)

    act4 = task_named(client, "Act 4")
    assert act4["id"] == legacy_id
    assert character(client, alt["id"])["difficulty_ids"][str(legacy_id)] == difficulty(act4, "Hard")["id"]


def test_bound_gold_is_tracked_separately(client, set_now):
    set_now(NOW)
    serca, cathedral, act4 = (task_named(client, n) for n in ["Serca", "Horizon Cathedral", "Act 4"])
    assert difficulty(cathedral, "Lv3")["bound_percent"] == 100
    assert difficulty(serca, "Normal")["bound_percent"] == 50

    alt = add_character(client, 1755, [
        {"task_id": serca["id"], "difficulty_id": difficulty(serca, "Normal")["id"]},
        {"task_id": cathedral["id"]},
        {"task_id": act4["id"]},
    ])
    for task in (serca, cathedral, act4):
        complete(client, alt["id"], task["id"])

    week = client.get("/api/gold/weekly?weeks=1").json()[0]
    assert week["raid_gold"] == 32000 + 50000 + 38000
    assert week["bound_gold"] == 16000 + 50000
    assert week["character_bound_gold"] == 50000  # Cathedral; Serca's half is roster-bound

    rows = client.get("/api/export/gold.csv").text.splitlines()
    assert rows[0].endswith("gold,roster_bound_gold,character_bound_gold,bonus_spent,note,account")


def test_upgrade_backfills_bound_gold_on_past_clears(client, set_now):
    from fastapi.testclient import TestClient
    from sqlalchemy import text

    import main
    from database import engine

    set_now(NOW)
    cathedral = task_named(client, "Horizon Cathedral")
    alt = add_character(client, 1755, [{"task_id": cathedral["id"]}])
    complete(client, alt["id"], cathedral["id"])

    # Simulate a database from before bound gold existed.
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE completions DROP COLUMN bound_gold"))

    with TestClient(main.app, base_url="http://127.0.0.1") as restarted:
        assert restarted.get("/api/gold/weekly?weeks=1").json()[0]["bound_gold"] == 50000


def test_item_level_up_keeps_this_weeks_runs_but_moves_future_ones(client, set_now):
    set_now(NOW)
    act4, cathedral = task_named(client, "Act 4"), task_named(client, "Horizon Cathedral")
    alt = add_character(client, 1705, [{"task_id": act4["id"]}, {"task_id": cathedral["id"]}])
    complete(client, alt["id"], act4["id"])  # Normal, 27,000 this week

    client.patch(f"/api/characters/{alt['id']}", json={"item_level": 1722})
    updated = character(client, alt["id"])
    # Next clears use the new tiers...
    assert updated["difficulty_ids"][str(act4["id"])] == difficulty(act4, "Hard")["id"]
    assert updated["difficulty_ids"][str(cathedral["id"])] == difficulty(cathedral, "Lv2")["id"]
    # ...but the clear already done this week stays as it was run.
    run = next(r for r in client.get("/api/tracker").json()["runs"] if r["task_id"] == act4["id"])
    assert run["difficulty_id"] == difficulty(act4, "Normal")["id"]
    assert raid_gold(client) == 27000

    # A clear made after the update uses the new tier.
    complete(client, alt["id"], cathedral["id"])
    assert raid_gold(client) == 27000 + 40000


def test_recap_counts_last_weeks_paying_clears(client, set_now):
    serca, act4 = task_named(client, "Serca"), task_named(client, "Act 4")
    main = add_character(client, 1775, [{"task_id": serca["id"]}, {"task_id": act4["id"]}])
    set_now(NOW - timedelta(days=7))
    complete(client, main["id"], serca["id"])
    complete(client, main["id"], act4["id"])
    set_now(NOW)
    complete(client, main["id"], serca["id"])  # this week: not in the recap

    recap = client.get("/api/recap").json()
    assert recap["paid_raids"] == {str(main["id"]): 2}
    assert recap["week"] < NOW.date().isoformat()


def test_weekly_history_per_character(client, set_now):
    serca, act4 = task_named(client, "Serca"), task_named(client, "Act 4")
    main = add_character(client, 1775, [{"task_id": serca["id"]}, {"task_id": act4["id"]}])
    alt = add_character(client, 1775, name="Alt", is_gold_earner=False)
    set_now(NOW - timedelta(days=7))
    complete(client, main["id"], serca["id"])
    set_now(NOW)
    complete(client, main["id"], serca["id"])
    complete(client, main["id"], act4["id"])
    complete(client, alt["id"], act4["id"])  # a raid that doesn't pay gold
    client.post("/api/gold-entries", json={"source": "Trade", "amount": 500, "character_id": main["id"]})

    history = client.get("/api/history/weekly?weeks=2").json()
    assert len(history["weeks"]) == 2
    last_week, this_week = history["characters"][str(main["id"])]
    assert (last_week["raids"], last_week["paid_raids"], last_week["gold"]) == (1, 1, 54000)
    assert (this_week["raids"], this_week["paid_raids"], this_week["gold"]) == (2, 2, 54000 + 38000 + 500)
    alt_week = history["characters"][str(alt["id"])][1]
    assert (alt_week["raids"], alt_week["paid_raids"], alt_week["gold"]) == (1, 0, 0)
