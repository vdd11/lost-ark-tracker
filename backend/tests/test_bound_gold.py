"""Character-bound gold, entered per character and kept up to date."""

from datetime import datetime

from tests.test_balances import check_in
from tests.test_raids import add_character, complete, task_named


def bound(client, character_id):
    return client.get("/api/bound-gold").json()[str(character_id)]


def test_unknown_until_entered_then_follows_earnings_and_spending(client, set_now):
    cathedral = task_named(client, "Horizon Cathedral")
    main = add_character(client, 1755, [{"task_id": cathedral["id"]}], name="Main")
    assert bound(client, main["id"]) is None

    set_now(datetime(2026, 10, 1, 12))
    assert client.put(f"/api/characters/{main['id']}/bound-gold", json={"amount": 12300}).status_code == 204
    assert bound(client, main["id"]) == 12300

    set_now(datetime(2026, 10, 2, 12))
    complete(client, main["id"], cathedral["id"], bought_bonus=True)  # Lv3: +50,000 bound, chest -16,000 from it
    client.post("/api/spending", json={"category": "honing", "amount": 6300, "character_id": main["id"]})
    assert bound(client, main["id"]) == 12300 + 50000 - 16000 - 6300

    # Entering it again starts over from the new figure.
    client.put(f"/api/characters/{main['id']}/bound-gold", json={"amount": 1000})
    assert bound(client, main["id"]) == 1000
    assert client.put(f"/api/characters/{main['id']}/bound-gold", json={"amount": -1}).status_code == 422
    assert client.put("/api/characters/999/bound-gold", json={"amount": 1}).status_code == 404


def test_weekly_check_ins_need_only_tradeable_and_roster_bound(client, set_now):
    cathedral = task_named(client, "Horizon Cathedral")
    main = add_character(client, 1755, [{"task_id": cathedral["id"]}], name="Main")
    set_now(datetime(2026, 10, 1, 12))
    client.put(f"/api/characters/{main['id']}/bound-gold", json={"amount": 20000})
    check_in(client, tradeable=100000, roster_bound=30000)

    set_now(datetime(2026, 10, 2, 12))
    complete(client, main["id"], cathedral["id"], bought_bonus=True)  # chest paid from Main's bound gold
    expected = client.get("/api/balances/expected").json()["expected"]
    assert (expected["tradeable"], expected["roster_bound"]) == (100000, 30000)
    assert expected["character_bound"] == {str(main["id"]): 20000 + 50000 - 16000}

    set_now(datetime(2026, 10, 3, 12))
    second = check_in(client, tradeable=95000, roster_bound=30000)
    assert second["untracked"]["total"] == 5000  # the chest isn't counted as missing gold


def test_older_check_ins_with_character_bound_gold_still_count(client, set_now):
    main = add_character(client, 1755, [], name="Main")
    set_now(datetime(2026, 10, 1, 12))
    check_in(client, tradeable=1000, roster_bound=0, character_bound={str(main["id"]): 777})
    set_now(datetime(2026, 10, 2, 12))
    assert bound(client, main["id"]) == 777


def test_bound_gold_is_backed_up_and_goes_with_the_character(client, set_now):
    main = add_character(client, 1755, [], name="Main")
    set_now(datetime(2026, 10, 1, 12))
    client.put(f"/api/characters/{main['id']}/bound-gold", json={"amount": 500})
    backup = client.get("/api/backup").json()
    assert backup["character_bound_checks"][0]["amount"] == 500
    client.delete(f"/api/characters/{main['id']}")
    assert client.post("/api/backup", json=backup).status_code == 204
    assert bound(client, main["id"]) == 500
