from datetime import date, datetime, timedelta

from rest import RestRules, rest_at_start_of, start_value_for_shown

CHAOS = RestRules(max=200, gain=20, cost=40)
DAY = date(2026, 10, 1)


def days(*offsets):
    return {DAY + timedelta(days=n) for n in offsets}


def test_skipped_days_fill_the_gauge_up_to_max():
    assert rest_at_start_of(DAY + timedelta(days=3), 0, DAY, set(), CHAOS) == 60
    assert rest_at_start_of(DAY + timedelta(days=30), 0, DAY, set(), CHAOS) == 200


def test_runs_spend_rest_only_when_there_is_enough():
    # Day 0 run with 30 rest: not rested, nothing spent. Day 1 skipped: +20.
    assert rest_at_start_of(DAY + timedelta(days=2), 30, DAY, days(0), CHAOS) == 50
    # Day 0 run with 50 rest: rested, spends 40.
    assert rest_at_start_of(DAY + timedelta(days=1), 50, DAY, days(0), CHAOS) == 10


def test_shown_value_after_todays_run_adds_the_cost_back():
    assert start_value_for_shown(60, completed_today=True, rules=CHAOS) == 100
    assert start_value_for_shown(60, completed_today=False, rules=CHAOS) == 60
    assert start_value_for_shown(500, completed_today=False, rules=CHAOS) == 200


# ---------- API ----------

def rest_for(client, character_id, task_id):
    return next(
        r for r in client.get("/api/tracker").json()["rest"]
        if r["character_id"] == character_id and r["task_id"] == task_id
    )


def chaos_task(client):
    return next(t for t in client.get("/api/tasks").json() if t["name"] == "Chaos Dungeon")


def test_default_rest_rules_are_seeded(client):
    tasks = {t["name"]: t for t in client.get("/api/tasks").json()}
    assert (tasks["Chaos Dungeon"]["rest_max"], tasks["Chaos Dungeon"]["rest_gain"], tasks["Chaos Dungeon"]["rest_cost"]) == (200, 20, 40)
    assert tasks["Guardian Raid"]["rest_max"] == 100
    assert tasks["Guild Weekly"]["rest_max"] == 0


def test_gauge_builds_while_skipping_and_drops_after_rested_run(client, set_now):
    set_now(datetime(2026, 10, 1, 12))
    character = client.post("/api/characters", json={"name": "Alt", "class_name": "Bard"}).json()
    chaos = chaos_task(client)
    assert rest_for(client, character["id"], chaos["id"]) == {
        "character_id": character["id"], "task_id": chaos["id"], "value": 0, "rested_run_available": False,
    }

    set_now(datetime(2026, 10, 3, 12))  # skipped Oct 1 and 2
    state = rest_for(client, character["id"], chaos["id"])
    assert (state["value"], state["rested_run_available"]) == (40, True)

    client.put(f"/api/characters/{character['id']}/tasks/{chaos['id']}/completion")
    state = rest_for(client, character["id"], chaos["id"])
    assert (state["value"], state["rested_run_available"]) == (0, False)

    client.delete(f"/api/characters/{character['id']}/tasks/{chaos['id']}/completion")
    assert rest_for(client, character["id"], chaos["id"])["value"] == 40

    client.put(f"/api/characters/{character['id']}/tasks/{chaos['id']}/completion")
    set_now(datetime(2026, 10, 4, 12))  # ran on Oct 3: 40 - 40
    assert rest_for(client, character["id"], chaos["id"])["value"] == 0


def test_syncing_with_the_game(client, set_now):
    set_now(datetime(2026, 10, 1, 12))
    character = client.post("/api/characters", json={"name": "Alt", "class_name": "Bard"}).json()
    chaos = chaos_task(client)
    url = f"/api/characters/{character['id']}/tasks/{chaos['id']}"

    assert client.put(f"{url}/rest", json={"value": 120}).status_code == 204
    assert rest_for(client, character["id"], chaos["id"])["value"] == 120

    # Entered after today's run: the game already shows the spent gauge.
    client.put(f"{url}/completion")
    client.put(f"{url}/rest", json={"value": 80})
    assert rest_for(client, character["id"], chaos["id"])["value"] == 80
    set_now(datetime(2026, 10, 2, 12))
    assert rest_for(client, character["id"], chaos["id"])["value"] == 80

    # Only assigned tasks with a gauge can be set.
    guild = next(t for t in client.get("/api/tasks").json() if t["name"] == "Guild Weekly")
    assert client.put(f"/api/characters/{character['id']}/tasks/{guild['id']}/rest", json={"value": 10}).status_code == 400
    client.delete(url)
    assert client.put(f"{url}/rest", json={"value": 10}).status_code == 404


def test_upgrading_an_old_database_adds_rest_rules(client):
    from fastapi.testclient import TestClient
    from sqlalchemy import text

    import main
    from database import engine

    # Simulate a v1.0.0 database, which had no rest columns.
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE tasks DROP COLUMN rest_max"))

    with TestClient(main.app) as restarted:
        assert chaos_task(restarted)["rest_max"] == 200
