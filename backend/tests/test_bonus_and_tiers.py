from datetime import datetime

from tests.test_raids import add_character, complete, difficulty, task_named

NOW = datetime(2026, 10, 2, 12)


def week(client):
    return client.get("/api/gold/weekly?weeks=1").json()[0]


def run_for(client, character_id, task_id):
    return next(
        r for r in client.get("/api/tracker").json()["runs"]
        if r["character_id"] == character_id and r["task_id"] == task_id
    )


def test_bonus_chest_costs_come_from_the_patch_notes(client):
    act4, final = task_named(client, "Act 4"), task_named(client, "The Final Day")
    assert (difficulty(act4, "Normal")["bonus_cost"], difficulty(act4, "Hard")["bonus_cost"]) == (8640, 12160)
    assert (difficulty(final, "Normal")["bonus_cost"], difficulty(final, "Hard")["bonus_cost"]) == (10240, 15360)
    assert difficulty(task_named(client, "Serca"), "Hard")["bonus_cost"] is None
    assert difficulty(task_named(client, "Horizon Cathedral"), "Lv3")["bound_kind"] == "character"


def test_buying_the_bonus_chest_is_subtracted_from_that_character(client, set_now):
    set_now(NOW)
    final = task_named(client, "The Final Day")
    sorc = add_character(client, 1775, [{"task_id": final["id"]}], name="Sorc")
    alt = add_character(client, 1735, [{"task_id": final["id"]}], name="Alt")

    complete(client, sorc["id"], final["id"], bought_bonus=True)
    complete(client, alt["id"], final["id"])
    assert run_for(client, sorc["id"], final["id"])["bonus_spent"] == 15360

    totals = week(client)
    assert (totals["raid_gold"], totals["bonus_spent"], totals["net"]) == (96000, 15360, 96000 - 15360)
    assert totals["by_character"] == {"Sorc": 48000 - 15360, "Alt": 48000}

    # Changing your mind refunds it.
    complete(client, sorc["id"], final["id"], bought_bonus=False)
    assert week(client)["bonus_spent"] == 0


def test_bonus_bought_on_a_non_paying_clear_still_costs_gold(client, set_now):
    set_now(NOW)
    act4 = task_named(client, "Act 4")
    friend_alt = add_character(client, 1725, [{"task_id": act4["id"]}], is_gold_earner=False)
    complete(client, friend_alt["id"], act4["id"], bought_bonus=True)
    assert (week(client)["raid_gold"], week(client)["net"]) == (0, -12160)


def test_cube_runs_can_be_split_across_lower_unlocks(client, set_now):
    set_now(NOW)
    cube = task_named(client, "Ebony Cube")
    tier = {d["name"]: d["id"] for d in cube["difficulties"]}
    alt = add_character(client, 1710, name="Alt")  # 3rd unlock is the highest

    complete(client, alt["id"], cube["id"], count=2)  # own tier: 2 x 3rd
    complete(client, alt["id"], cube["id"], tier_counts={tier["1st"]: 1, tier["2nd"]: 3})
    run = run_for(client, alt["id"], cube["id"])
    assert run["count"] == 6
    assert run["tier_counts"] == {str(tier["1st"]): 1, str(tier["2nd"]): 3, str(tier["3rd"]): 2}
    # 1x6 + 3x12 + 2x16 = 74 Lv2 gems
    assert client.get("/api/gems/weekly?weeks=1").json()[0]["by_level"] == {"2": 74}

    # Can't log tickets for an unlock above the character's item level.
    assert complete(client, alt["id"], cube["id"], tier_counts={tier["4th"]: 1}).status_code == 400

    # The +/- on the cell changes only the character's own tier.
    complete(client, alt["id"], cube["id"], count=0)
    assert run_for(client, alt["id"], cube["id"])["count"] == 4

    # Zeroing every tier removes the week's entry.
    complete(client, alt["id"], cube["id"], tier_counts={tier["1st"]: 0, tier["2nd"]: 0})
    assert all(r["task_id"] != cube["id"] for r in client.get("/api/tracker").json()["runs"])


def test_upgrade_hides_unas_tasks_and_splits_bound_gold(client, set_now):
    from fastapi.testclient import TestClient
    from sqlalchemy import text

    import main
    from database import engine

    set_now(NOW)
    cathedral = task_named(client, "Horizon Cathedral")
    alt = add_character(client, 1755, [{"task_id": cathedral["id"]}])
    complete(client, alt["id"], cathedral["id"])
    client.post("/api/tasks", json={"name": "Una's Dailies", "category": "daily"})

    # Simulate a 1.7 database: no character-bound column yet.
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE completions DROP COLUMN character_bound_gold"))

    with TestClient(main.app) as restarted:
        assert all(t["name"] != "Una's Dailies" for t in restarted.get("/api/tasks").json())
        assert restarted.get("/api/gold/weekly?weeks=1").json()[0]["character_bound_gold"] == 50000
