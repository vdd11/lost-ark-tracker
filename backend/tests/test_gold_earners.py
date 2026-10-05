"""Six gold earners per account (roster); more characters are fine."""

from tests.test_raids import add_character


def test_a_seventh_gold_earner_is_refused(client):
    for i in range(6):
        add_character(client, 1700, [], name=f"Earner{i}")
    response = client.post("/api/characters", json={"name": "Seventh", "class_name": "Bard", "is_gold_earner": True})
    assert response.status_code == 400
    assert "already has 6 gold earners" in response.json()["detail"]

    # A non-earner can still join, but can't become an earner while all 6 slots are used.
    spare = add_character(client, 1700, [], name="Spare", is_gold_earner=False)
    assert client.patch(f"/api/characters/{spare['id']}", json={"is_gold_earner": True}).status_code == 400

    # Free a slot and it can.
    earner = client.get("/api/characters").json()[0]
    assert client.patch(f"/api/characters/{earner['id']}", json={"is_gold_earner": False}).status_code == 200
    assert client.patch(f"/api/characters/{spare['id']}", json={"is_gold_earner": True}).json()["is_gold_earner"]


def test_each_account_has_its_own_six(client):
    alt = client.post("/api/accounts", json={"name": "Alt"}).json()
    for i in range(6):
        add_character(client, 1700, [], name=f"Main{i}")
    other = client.post("/api/characters", json={"name": "AltMain", "class_name": "Bard", "account_id": alt["id"]})
    assert other.status_code == 201

    # Moving an earner into a full account is refused; editing an earner in place is fine.
    assert client.patch(f"/api/characters/{other.json()['id']}", json={"account_id": 1}).status_code == 400
    first = client.get("/api/characters").json()[0]
    assert client.patch(f"/api/characters/{first['id']}", json={"item_level": 1710}).status_code == 200
