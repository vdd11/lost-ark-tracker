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
