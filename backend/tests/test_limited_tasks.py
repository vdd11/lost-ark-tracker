"""Tasks done a number of times a period, counters that reset, and
character-bound gold logged by hand (Chaos Gate rewards since Feb 2026)."""

from datetime import datetime

from tests.test_raids import add_character, complete


def runs(client, character_id, task_id):
    run = next((r for r in client.get("/api/tracker").json()["runs"] if r["character_id"] == character_id and r["task_id"] == task_id), None)
    return run["count"] if run else 0


def test_a_limited_task_counts_up_to_its_limit_each_period(client, set_now):
    set_now(datetime(2026, 10, 8, 12))
    elysian = client.post("/api/tasks", json={"name": "Elysian", "category": "weekly", "run_limit": 5}).json()
    assert elysian["run_limit"] == 5
    main = add_character(client, 1700)  # new weeklies apply to everyone

    assert complete(client, main["id"], elysian["id"], count=3).status_code == 204
    assert runs(client, main["id"], elysian["id"]) == 3
    assert complete(client, main["id"], elysian["id"], count=6).status_code == 400
    assert runs(client, main["id"], elysian["id"]) == 3

    # A new week starts from nothing; raising the limit (bonus entries) is an edit.
    set_now(datetime(2026, 10, 15, 12))
    assert runs(client, main["id"], elysian["id"]) == 0
    assert client.patch(f"/api/tasks/{elysian['id']}", json={"run_limit": 7}).json()["run_limit"] == 7
    assert complete(client, main["id"], elysian["id"], count=7).status_code == 204


def test_counters_can_reset_daily_or_weekly(client, set_now):
    set_now(datetime(2026, 10, 8, 12))
    daily = client.post("/api/counters", json={"name": "Roster energy runs", "resets": "daily", "target": 3}).json()
    weekly = client.post("/api/counters", json={"name": "Weekly thing", "resets": "weekly"}).json()
    kept = client.post("/api/counters", json={"name": "Mokoko seeds"}).json()
    for counter in (daily, weekly, kept):
        client.patch(f"/api/counters/{counter['id']}", json={"add": 2})

    set_now(datetime(2026, 10, 9, 12))  # next day, same week
    values = {c["name"]: c["value"] for c in client.get("/api/counters").json()}
    assert values == {"Roster energy runs": 0, "Weekly thing": 2, "Mokoko seeds": 2}

    set_now(datetime(2026, 10, 14, 12))  # next week
    values = {c["name"]: c["value"] for c in client.get("/api/counters").json()}
    assert values == {"Roster energy runs": 0, "Weekly thing": 0, "Mokoko seeds": 2}

    # Turning reset off keeps counting from where it is.
    url = f"/api/counters/{kept['id']}"
    assert client.patch(url, json={"resets": "never", "add": 1}).json()["value"] == 3


def test_character_bound_gold_goes_to_that_characters_bound_total(client, set_now):
    set_now(datetime(2026, 10, 8, 12))
    main = add_character(client, 1700, name="Main")
    client.put(f"/api/characters/{main['id']}/bound-gold", json={"amount": 1000})
    set_now(datetime(2026, 10, 8, 13))
    response = client.post("/api/gold-entries", json={"source": "Chaos Gate", "amount": 2500, "character_id": main["id"], "character_bound": True})
    assert response.status_code == 201 and response.json()["character_bound"] is True
    client.post("/api/gold-entries", json={"source": "Chaos Gate", "amount": 800, "character_id": main["id"]})

    assert client.get("/api/bound-gold").json()[str(main["id"])] == 1000 + 2500
    week = client.get("/api/gold/weekly?weeks=1").json()[0]
    # Only the sold drops are shared gold; the bound gold is the character's.
    assert week["other_gold"] == 800
    assert week["tradeable_left"] == 800
    assert week["character_bound"][str(main["id"])]["earned"] == 2500

    assert client.post("/api/gold-entries", json={"source": "Chaos Gate", "amount": 1, "character_bound": True}).status_code == 400
