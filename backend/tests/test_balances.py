from datetime import datetime

from tests.test_raids import add_character, complete, difficulty, task_named


def check_in(client, **body):
    response = client.post("/api/balances", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_check_ins_reveal_untracked_spending(client, set_now):
    cathedral, final = task_named(client, "Horizon Cathedral"), task_named(client, "The Final Day")
    final_normal = difficulty(final, "Normal")["id"]
    main = add_character(client, 1755, [{"task_id": cathedral["id"]}], name="Main")
    key = str(main["id"])

    set_now(datetime(2026, 10, 1, 12))
    first = check_in(client, tradeable=100000, roster_bound=20000, character_bound={key: 5000})
    assert first["expected"] is None and first["untracked"] is None

    set_now(datetime(2026, 10, 2, 12))
    complete(client, main["id"], cathedral["id"])  # 50,000 character-bound
    complete(client, main["id"], final["id"], difficulty_id=final_normal, bought_bonus=True)  # 16k roster + 16k tradeable, -10,240
    client.post("/api/gold-entries", json={"source": "Field Boss", "amount": 1500})

    expected = client.get("/api/balances/expected").json()["expected"]
    assert expected["tradeable"] == 100000 + 16000 + 1500
    assert expected["roster_bound"] == 20000 + 16000
    # The bonus chests came out of Main's character-bound gold.
    assert expected["character_bound"] == {key: 5000 + 50000 - 10240}

    set_now(datetime(2026, 10, 3, 12))
    second = check_in(client, tradeable=90000, roster_bound=36000, character_bound={key: 44760}, note="honing")
    assert second["untracked"] == {
        "tradeable": 117500 - 90000, "roster_bound": 0, "character_bound": {key: 0}, "total": 27500,
    }

    assert client.get("/api/gold/weekly?weeks=1").json()[0]["untracked_spent"] == 27500
    history = client.get("/api/balances").json()
    assert [c["id"] for c in history] == [second["id"], first["id"]]

    # Nothing happened since: expected is just the last check-in.
    assert client.get("/api/balances/expected").json()["expected"]["total"] == 90000 + 36000 + 44760


def test_characters_missing_from_a_check_in_are_not_compared(client, set_now):
    main = add_character(client, 1755, name="Main")
    alt = add_character(client, 1755, name="Alt")
    set_now(datetime(2026, 10, 1, 12))
    check_in(client, tradeable=0, roster_bound=0, character_bound={str(main["id"]): 1000})
    set_now(datetime(2026, 10, 2, 12))
    second = check_in(client, tradeable=0, roster_bound=0, character_bound={str(alt["id"]): 500})
    assert second["untracked"]["character_bound"] == {}
    assert second["untracked"]["total"] == 0


def test_check_in_validation_and_delete(client, set_now):
    set_now(datetime(2026, 10, 1, 12))
    assert client.get("/api/balances/expected").json() is None
    assert client.post("/api/balances", json={"tradeable": 0, "roster_bound": 0, "character_bound": {"999": 5}}).status_code == 400
    assert client.post("/api/balances", json={"tradeable": 0, "roster_bound": -1}).status_code == 422
    check = check_in(client, tradeable=10, roster_bound=0)
    assert client.delete(f"/api/balances/{check['id']}").status_code == 204
    assert client.get("/api/balances").json() == []


def test_bonus_chests_count_when_bought_not_when_cleared(client, set_now):
    final = task_named(client, "The Final Day")
    alt = add_character(client, 1715, [{"task_id": final["id"]}], name="Alt")  # Normal: 16k roster + 16k tradeable

    set_now(datetime(2026, 10, 1, 12))
    check_in(client, tradeable=0, roster_bound=0)
    set_now(datetime(2026, 10, 2, 12))
    complete(client, alt["id"], final["id"])
    set_now(datetime(2026, 10, 3, 12))
    second = check_in(client, tradeable=16000, roster_bound=16000)
    assert second["untracked"]["total"] == 0

    # Chests bought after that check-in belong to the next window, not the old one.
    set_now(datetime(2026, 10, 4, 12))
    complete(client, alt["id"], final["id"], bought_bonus=True)  # 10,240 from roster-bound
    set_now(datetime(2026, 10, 5, 12))
    third = check_in(client, tradeable=16000, roster_bound=16000 - 10240)
    history = {c["id"]: c for c in client.get("/api/balances").json()}
    assert history[second["id"]]["untracked"]["total"] == 0
    assert third["untracked"]["total"] == 0


def test_filling_in_unknown_values_updates_this_weeks_clears(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    serca = task_named(client, "Serca")
    hard = difficulty(serca, "Normal")  # its chest cost isn't known yet
    assert hard["bonus_cost"] is None
    main = add_character(client, 1735, [{"task_id": serca["id"], "difficulty_id": hard["id"]}], name="Main")
    complete(client, main["id"], serca["id"], difficulty_id=hard["id"], bought_bonus=True)
    assert client.get("/api/gold/weekly?weeks=1").json()[0]["bonus_spent"] == 0

    client.patch(f"/api/difficulties/{hard['id']}", json={"bonus_cost": 9000})
    week = client.get("/api/gold/weekly?weeks=1").json()[0]
    assert (week["raid_gold"], week["bonus_spent"]) == (32000, 9000)

    # A value that was already known isn't rewritten for clears already made.
    client.patch(f"/api/difficulties/{hard['id']}", json={"bonus_cost": 1})
    assert client.get("/api/gold/weekly?weeks=1").json()[0]["bonus_spent"] == 9000


def test_gold_on_hand_cannot_be_negative(client):
    assert client.post("/api/balances", json={"tradeable": -5, "roster_bound": 0}).status_code == 422
