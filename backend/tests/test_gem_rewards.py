from datetime import datetime

from tests.test_raids import add_character, complete, difficulty, task_named

NOW = datetime(2026, 10, 2, 12)


def weekly_gems(client):
    return client.get("/api/gems/weekly?weeks=1").json()[0]


def set_rewards(client, task, tier, **tables):
    return client.patch(f"/api/difficulties/{difficulty(task, tier)['id']}", json=tables).json()


def test_hourglass_is_seeded_with_its_levels(client):
    hourglass = task_named(client, "Haal's Hourglass")
    assert hourglass["sand_scaled"] is True
    assert [(d["name"], d["min_item_level"]) for d in hourglass["difficulties"]] == [("Lv1", 1730), ("Lv2", 1750)]
    assert difficulty(hourglass, "Lv1")["reward_gems"] == {"2": 15}


def test_cube_runs_and_lucky_rooms_add_expected_gems(client, set_now):
    set_now(NOW)
    cube = task_named(client, "Ebony Cube")
    set_rewards(client, cube, "4th", reward_gems={"1": 2, "2": 0.5}, lucky_gems={"2": 3}, mega_gems={"3": 4})
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
    set_rewards(client, hourglass, "Lv1", lucky_gems={"1": 6})
    alt = add_character(client, 1735)

    complete(client, alt["id"], hourglass["id"], sands=5, lucky_rooms=1)
    # 15 Lv2 x (1 + 5 sands) = 90 Lv2 = 270, plus 6 Lv1 from the lucky room.
    assert weekly_gems(client)["total"] == 276


def test_recorded_gems_survive_later_reward_edits(client, set_now):
    set_now(NOW)
    hourglass = task_named(client, "Haal's Hourglass")
    alt = add_character(client, 1735)
    complete(client, alt["id"], hourglass["id"])
    assert weekly_gems(client)["total"] == 45

    set_rewards(client, hourglass, "Lv1", reward_gems={"2": 99})
    assert weekly_gems(client)["total"] == 45

    # Changing this week's run uses the new table.
    complete(client, alt["id"], hourglass["id"], sands=1)
    assert weekly_gems(client)["total"] == 99 * 2 * 3


def test_reset_restores_catalog_rewards(client):
    hourglass = task_named(client, "Haal's Hourglass")
    edited = set_rewards(client, hourglass, "Lv1", reward_gems={"2": 1}, lucky_gems={"1": 2})
    assert edited["reward_gems"] == {"2": 1}

    reset = client.post(f"/api/difficulties/{edited['id']}/reset").json()
    assert (reset["reward_gems"], reset["lucky_gems"]) == ({"2": 15}, None)


def test_rejects_bad_gem_tables(client):
    hourglass = task_named(client, "Haal's Hourglass")
    tier = difficulty(hourglass, "Lv1")["id"]
    assert client.patch(f"/api/difficulties/{tier}", json={"reward_gems": {"11": 1}}).status_code == 422
    assert client.patch(f"/api/difficulties/{tier}", json={"reward_gems": {"2": -1}}).status_code == 422
    alt = add_character(client, 1735)
    assert complete(client, alt["id"], hourglass["id"], sands=6).status_code == 422


def test_runs_without_gems_dont_break_the_weekly_summary(client, set_now):
    set_now(NOW)
    cube = task_named(client, "Ebony Cube")  # no reward table yet
    main = add_character(client, 1775)
    complete(client, main["id"], cube["id"], count=1)
    act4 = task_named(client, "Act 4")
    complete(client, main["id"], act4["id"])

    response = client.get("/api/gems/weekly?weeks=1")
    assert response.status_code == 200
    assert response.json()[0]["total"] == 0
