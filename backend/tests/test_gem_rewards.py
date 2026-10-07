from dataclasses import replace
from datetime import datetime

import raids
from database import SessionLocal
from models import RaidDifficulty
from tests.test_raids import add_character, complete, difficulty, task_named

NOW = datetime(2026, 10, 2, 12)


def weekly_gems(client):
    return client.get("/api/gems/weekly?weeks=1").json()[0]


def set_rewards(client, task, tier, **tables):
    """Through the API: only gem tables the catalog doesn't know can be filled in."""
    return client.patch(f"/api/difficulties/{difficulty(task, tier)['id']}", json=tables)


def set_tables(task, tier, **tables):
    """Straight into the database, standing in for what a catalog update would write."""
    with SessionLocal() as db:
        row = db.get(RaidDifficulty, difficulty(task, tier)["id"])
        for field, value in tables.items():
            setattr(row, field, value)
        db.commit()


def test_cube_unlocks_are_seeded_with_gems_per_ticket(client, set_now):
    set_now(NOW)
    cube = task_named(client, "Ebony Cube")
    assert [difficulty(cube, t)["reward_gems"] for t in ["1st", "2nd", "3rd", "4th"]] == [
        {"2": 6}, {"2": 12}, {"2": 16}, {"2": 22},
    ]

    # Two 4th-unlock tickets: 44 Lv2 gems = 132 Lv1 equivalents.
    main = add_character(client, 1775)
    complete(client, main["id"], cube["id"], count=2)
    assert weekly_gems(client)["by_level"] == {"2": 44}
    assert weekly_gems(client)["by_character"] == {"Main": 132}


def test_hourglass_is_seeded_with_its_levels(client):
    hourglass = task_named(client, "Haal's Hourglass")
    assert hourglass["sand_scaled"] is True
    assert [(d["name"], d["min_item_level"]) for d in hourglass["difficulties"]] == [("Lv1", 1730), ("Lv2", 1750)]
    assert difficulty(hourglass, "Lv1")["reward_gems"] == {"2": 15}


def test_cube_runs_and_lucky_rooms_add_expected_gems(client, set_now):
    set_now(NOW)
    cube = task_named(client, "Ebony Cube")
    set_tables(cube, "4th", reward_gems={"1": 2, "2": 0.5}, lucky_gems={"2": 3}, mega_gems={"3": 4})
    main = add_character(client, 1775)

    complete(client, main["id"], cube["id"], count=2, lucky_rooms=1)
    # 2 runs x (2 Lv1 + 0.5 Lv2) + 1 lucky room x 3 Lv2 = 4 Lv1 + 4 Lv2 = 4 + 12
    week = weekly_gems(client)
    assert week["total"] == 16
    assert week["by_source"] == {"Ebony Cube": 16}
    assert week["by_character"] == {"Main": 16}

    complete(client, main["id"], cube["id"], mega_rooms=1)  # + 4 Lv3 = 36
    assert weekly_gems(client)["total"] == 52


def test_sands_multiply_hourglass_but_not_lucky_rooms(client, set_now):
    set_now(NOW)
    hourglass = task_named(client, "Haal's Hourglass")
    assert difficulty(hourglass, "Lv1")["lucky_gems"] == {"3": 6}
    alt = add_character(client, 1735)

    complete(client, alt["id"], hourglass["id"], sands=5, lucky_rooms=1)
    # 15 Lv2 x (1 + 5 sands) = 90 Lv2 = 270, plus the lucky monster's 6 Lv3 = 54.
    assert weekly_gems(client)["total"] == 324


def test_recorded_gems_survive_later_reward_edits(client, set_now):
    set_now(NOW)
    hourglass = task_named(client, "Haal's Hourglass")
    alt = add_character(client, 1735)
    complete(client, alt["id"], hourglass["id"])
    assert weekly_gems(client)["total"] == 45

    set_tables(hourglass, "Lv1", reward_gems={"2": 99})
    assert weekly_gems(client)["total"] == 45

    # Changing this week's run uses the new table.
    complete(client, alt["id"], hourglass["id"], sands=1)
    assert weekly_gems(client)["total"] == 99 * 2 * 3


def test_gem_tables_are_the_apps_except_unknown_ones(client, monkeypatch):
    cube = task_named(client, "Ebony Cube")
    hourglass = task_named(client, "Haal's Hourglass")
    assert difficulty(cube, "4th")["lucky_gems"] == {"3": 7}

    # Known tables come with app updates; unknown ones can be filled in.
    assert set_rewards(client, cube, "4th", reward_gems={"2": 1}).status_code == 400
    assert set_rewards(client, cube, "4th", lucky_gems={"2": 1}).status_code == 400
    assert set_rewards(client, cube, "1st", lucky_gems={"2": 2}).status_code == 200
    assert set_rewards(client, hourglass, "Lv2", lucky_gems={"1": 3}).status_code == 200

    # A sync overwrites an edited known table, keeps what users entered for an
    # unknown one, and a newly known value replaces theirs.
    set_tables(cube, "4th", reward_gems={"2": 1})
    patched = [
        replace(item, difficulties=[replace(d, lucky_gems={"2": 9}) if d.name == "Lv2" else d for d in item.difficulties])
        if item.key == "haals-hourglass" else item
        for item in raids.CATALOG
    ]
    monkeypatch.setattr(raids, "CATALOG", patched)
    with SessionLocal() as db:
        raids.sync_catalog(db)
    cube = task_named(client, "Ebony Cube")
    hourglass = task_named(client, "Haal's Hourglass")
    assert difficulty(cube, "4th")["reward_gems"] == {"2": 22}
    assert difficulty(cube, "1st")["lucky_gems"] == {"2": 2}
    assert difficulty(hourglass, "Lv2")["lucky_gems"] == {"2": 9}


def test_rejects_bad_gem_tables(client):
    hourglass = task_named(client, "Haal's Hourglass")
    tier = difficulty(hourglass, "Lv1")["id"]
    assert client.patch(f"/api/difficulties/{tier}", json={"reward_gems": {"11": 1}}).status_code == 422
    assert client.patch(f"/api/difficulties/{tier}", json={"reward_gems": {"2": -1}}).status_code == 422
    alt = add_character(client, 1735)
    assert complete(client, alt["id"], hourglass["id"], sands=6).status_code == 422


def test_runs_without_gems_dont_break_the_weekly_summary(client, set_now):
    set_now(NOW)
    hourglass = task_named(client, "Haal's Hourglass")
    set_tables(hourglass, "Lv2", reward_gems=None)  # a tier with no reward table
    main = add_character(client, 1775)
    complete(client, main["id"], hourglass["id"])
    act4 = task_named(client, "Act 4")
    complete(client, main["id"], act4["id"])

    response = client.get("/api/gems/weekly?weeks=1")
    assert response.status_code == 200
    assert response.json()[0]["total"] == 0


def test_hourglass_level_two_gives_level_three_gems(client, set_now):
    set_now(NOW)
    hourglass = task_named(client, "Haal's Hourglass")
    assert difficulty(hourglass, "Lv2")["reward_gems"] == {"3": 6}
    assert set_rewards(client, hourglass, "Lv2", lucky_gems={"3": 1}).status_code == 200
    main = add_character(client, 1775)  # Lv2

    complete(client, main["id"], hourglass["id"], sands=5, lucky_rooms=1)
    # 6 Lv3 x (1 + 5 sands) = 36 Lv3; the lucky monster's 1 Lv3 isn't multiplied.
    assert weekly_gems(client)["by_level"] == {"3": 37}


def test_gem_total_matches_the_full_weekly_history(client, set_now):
    from datetime import datetime

    set_now(datetime(2026, 8, 5, 12))
    client.post("/api/gem-entries", json={"source": "Field Boss", "gems": {"3": 1}})
    set_now(datetime(2026, 10, 7, 12))
    client.post("/api/gem-entries", json={"source": "Chaos Gate", "gems": {"1": 2}})
    weekly = client.get("/api/gems/weekly?weeks=520").json()
    total = client.get("/api/gems/total").json()["total"]
    assert total == round(sum(w["total"] for w in weekly), 1) == 9 + 2
    assert client.get("/api/gems/total?account_id=999").json()["total"] == 0


def test_a_guardian_raid_adds_the_gems_for_the_characters_item_level(client, set_now):
    from datetime import datetime

    set_now(datetime(2026, 10, 8, 12))
    guardian = next(t for t in client.get("/api/tasks").json() if t["name"] == "Guardian Raid")
    for name, item_level in (("Shady", 1752), ("Krath", 1725), ("Argy", 1650), ("Lowbie", 1600)):
        character = client.post("/api/characters", json={"name": name, "class_name": "Bard", "item_level": item_level}).json()
        assert client.put(f"/api/characters/{character['id']}/tasks/{guardian['id']}/completion").status_code == 204

    week = client.get("/api/gems/weekly?weeks=1").json()[0]
    # Shade Lv2 11.5 + Krathios 6.5 + Argeos 3; nothing below the T4 Guardians.
    assert week["by_source"] == {"Guardian Raid": 21.0}
    assert week["by_level"] == {"1": 21.0}
    assert week["by_character"] == {"Shady": 11.5, "Krath": 6.5, "Argy": 3.0}
