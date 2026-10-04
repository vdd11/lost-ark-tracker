"""Logged spending, and how check-ins count it."""

from datetime import datetime

from tests.test_balances import check_in
from tests.test_raids import add_character


def spend(client, **body):
    response = client.post("/api/spending", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_logged_spending_is_not_untracked(client, set_now):
    main = add_character(client, 1700, [], name="Main")
    key = str(main["id"])
    set_now(datetime(2026, 10, 1, 12))
    check_in(client, tradeable=100000, roster_bound=20000, character_bound={key: 5000})

    set_now(datetime(2026, 10, 2, 12))
    # Honing uses Main's bound gold first: 5,000 character, 20,000 roster, 5,000 tradeable.
    honing = spend(client, category="honing", amount=30000, character_id=main["id"], note="+1 weapon")
    assert honing["paid_from"] == "bound_first" and honing["account_id"] == main["account_id"]
    # The market only takes tradeable gold.
    assert spend(client, category="market", amount=10000)["paid_from"] == "tradeable"

    expected = client.get("/api/balances/expected").json()["expected"]
    assert expected == {"tradeable": 85000, "roster_bound": 0, "character_bound": {key: 0}, "total": 85000}

    set_now(datetime(2026, 10, 3, 12))
    second = check_in(client, tradeable=80000, roster_bound=0, character_bound={key: 0})
    assert second["untracked"]["total"] == 5000  # only what wasn't logged


def test_spending_before_the_last_check_in_is_already_counted(client, set_now):
    set_now(datetime(2026, 10, 1, 12))
    spend(client, category="other", amount=999)
    set_now(datetime(2026, 10, 2, 12))
    check_in(client, tradeable=1000, roster_bound=0)
    assert client.get("/api/balances/expected").json()["expected"]["tradeable"] == 1000


def test_validation_list_and_delete(client, set_now):
    assert client.post("/api/spending", json={"category": "food", "amount": 5}).status_code == 422
    assert client.post("/api/spending", json={"category": "gems", "amount": 0}).status_code == 422
    bad = client.post("/api/spending", json={"category": "market", "amount": 5, "paid_from": "bound_first"})
    assert bad.status_code == 400
    assert client.post("/api/spending", json={"category": "gems", "amount": 5, "character_id": 999}).status_code == 404

    set_now(datetime(2026, 10, 1, 12))
    first = spend(client, category="gems", amount=5)
    set_now(datetime(2026, 10, 2, 12))
    second = spend(client, category="honing", amount=7, paid_from="tradeable")
    assert [e["id"] for e in client.get("/api/spending").json()] == [second["id"], first["id"]]
    assert client.delete(f"/api/spending/{first['id']}").status_code == 204
    assert [e["id"] for e in client.get("/api/spending").json()] == [second["id"]]


def test_spending_is_per_account(client):
    alt = client.post("/api/accounts", json={"name": "Alt"}).json()
    spend(client, category="other", amount=10)
    spend(client, category="other", amount=20, account_id=alt["id"])
    assert [e["amount"] for e in client.get(f"/api/spending?account_id={alt['id']}").json()] == [20]


def test_spending_exports_as_csv(client, set_now):
    set_now(datetime(2026, 10, 1, 12))
    spend(client, category="honing", amount=1234, note="armor")
    lines = client.get("/api/export/spending.csv").text.splitlines()
    assert lines[0] == "time,week,category,amount,paid_from,character,note,account"
    assert lines[1].startswith("2026-10-01T12:00,2026-09-30,honing,1234,bound_first,,armor,")


def test_deleting_a_character_keeps_their_spending_on_the_account(client):
    main = add_character(client, 1700, [], name="Main")
    entry = spend(client, category="honing", amount=50, character_id=main["id"])
    assert client.delete(f"/api/characters/{main['id']}").status_code == 204
    kept = client.get("/api/spending").json()[0]
    assert (kept["id"], kept["character_id"], kept["account_id"]) == (entry["id"], None, main["account_id"])
