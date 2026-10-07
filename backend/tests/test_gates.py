"""Raids cleared gate by gate (per-gate gold and rules from the user, 2026-10-06)."""

from datetime import datetime

from raids import CATALOG
from tests.test_raids import add_character, complete, difficulty, task_named


def run_of(client, character_id, task_id):
    return next((r for r in client.get("/api/tracker").json()["runs"] if r["character_id"] == character_id and r["task_id"] == task_id), None)


def week(client):
    return client.get("/api/gold/weekly?weeks=1").json()[0]


def test_catalog_gates_add_up_to_the_raid():
    for item in CATALOG:
        if item.category != "raid":
            continue
        assert item.gates == 2, item.name
        for spec in item.difficulties:
            assert spec.gate_gold and sum(spec.gate_gold) == spec.gold, (item.name, spec.name)
            assert spec.gate_bonus and sum(spec.gate_bonus) == spec.bonus_cost, (item.name, spec.name)


def test_one_gate_pays_that_gate_and_uses_a_paid_raid(client, set_now):
    set_now(datetime(2026, 10, 8, 12))
    serca, cathedral, final_day, act4 = (task_named(client, n) for n in ("Serca", "Horizon Cathedral", "The Final Day", "Act 4"))
    main = add_character(client, 1745)
    hard = difficulty(serca, "Hard")["id"]

    assert complete(client, main["id"], serca["id"], gates={1: hard}).status_code == 204
    run = run_of(client, main["id"], serca["id"])
    assert run["gates"] == {"1": hard}
    assert week(client)["raid_gold"] == 17500

    # Gate 1 of two more raids: three raids have paid, so a fourth pays nothing.
    complete(client, main["id"], cathedral["id"], gates={1: difficulty(cathedral, "Lv2")["id"]})
    complete(client, main["id"], final_day["id"], gates={1: difficulty(final_day, "Hard")["id"]})
    complete(client, main["id"], act4["id"])
    assert week(client)["raid_gold"] == 17500 + 16000 + 16000

    # Gate 2 later, at another difficulty, pays that difficulty's gate 2.
    nightmare = difficulty(serca, "Nightmare")["id"]
    complete(client, main["id"], serca["id"], gates={2: nightmare})
    assert run_of(client, main["id"], serca["id"])["gates"] == {"1": hard, "2": nightmare}
    assert week(client)["raid_gold"] == 17500 + 33000 + 16000 + 16000


def test_gates_at_one_difficulty_are_a_whole_clear_and_unclearing_works(client, set_now):
    set_now(datetime(2026, 10, 8, 12))
    serca = task_named(client, "Serca")
    main = add_character(client, 1745)
    hard = difficulty(serca, "Hard")["id"]
    complete(client, main["id"], serca["id"], gates={1: hard})
    complete(client, main["id"], serca["id"], gates={2: hard})
    run = run_of(client, main["id"], serca["id"])
    assert run["gates"] is None and run["difficulty_id"] == hard
    assert week(client)["raid_gold"] == 44000

    complete(client, main["id"], serca["id"], gates={1: 0})
    assert run_of(client, main["id"], serca["id"])["gates"] == {"2": hard}
    assert week(client)["raid_gold"] == 26500
    complete(client, main["id"], serca["id"], gates={2: 0})
    assert run_of(client, main["id"], serca["id"]) is None

    assert complete(client, main["id"], serca["id"], gates={3: hard}).status_code == 400


def test_bound_gold_and_bonus_chests_follow_the_gates(client, set_now):
    set_now(datetime(2026, 10, 8, 12))
    serca, cathedral = task_named(client, "Serca"), task_named(client, "Horizon Cathedral")
    main = add_character(client, 1745)
    # Serca Normal is half roster-bound on each gate.
    complete(client, main["id"], serca["id"], gates={1: difficulty(serca, "Normal")["id"]}, bought_bonus=True)
    # Horizon Cathedral is all character-bound.
    complete(client, main["id"], cathedral["id"], gates={1: difficulty(cathedral, "Lv1")["id"]})
    gold = week(client)
    assert gold["raid_gold"] == 13000 + 13500
    assert gold["bound_gold"] == 6500 + 13500
    assert gold["character_bound_gold"] == 13500
    # Only gate 1's bonus chest was there to buy.
    assert run_of(client, main["id"], serca["id"])["bonus_spent"] == 4480


def test_a_difficulty_for_the_whole_raid_clears_every_gate(client, set_now):
    set_now(datetime(2026, 10, 8, 12))
    serca = task_named(client, "Serca")
    main = add_character(client, 1745)
    complete(client, main["id"], serca["id"], gates={1: difficulty(serca, "Normal")["id"]})
    complete(client, main["id"], serca["id"], difficulty_id=difficulty(serca, "Hard")["id"])
    run = run_of(client, main["id"], serca["id"])
    assert run["gates"] is None and week(client)["raid_gold"] == 44000
