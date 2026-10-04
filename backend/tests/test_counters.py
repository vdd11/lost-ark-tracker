"""Progress counters: add, count up and down, targets, ownership, backups."""

from tests.test_raids import add_character


def test_count_up_and_down_never_below_zero(client):
    counter = client.post("/api/counters", json={"name": " Mokoko seeds ", "target": 1500}).json()
    assert (counter["name"], counter["value"], counter["target"]) == ("Mokoko seeds", 0, 1500)
    url = f"/api/counters/{counter['id']}"
    assert client.patch(url, json={"add": 1}).json()["value"] == 1
    assert client.patch(url, json={"add": 10}).json()["value"] == 11
    assert client.patch(url, json={"add": -50}).json()["value"] == 0
    assert client.patch(url, json={"value": 1200, "target": None}).json() == {**counter, "value": 1200, "target": None}


def test_character_counters_follow_their_account_and_go_with_them(client):
    main = add_character(client, 1700, [], name="Main")
    counter = client.post("/api/counters", json={"name": "Island tokens", "character_id": main["id"]}).json()
    assert counter["account_id"] == main["account_id"]
    assert client.post("/api/counters", json={"name": "x", "character_id": 999}).status_code == 404
    client.delete(f"/api/characters/{main['id']}")
    assert client.get("/api/counters").json() == []


def test_validation_order_and_delete(client):
    assert client.post("/api/counters", json={"name": ""}).status_code == 422
    assert client.post("/api/counters", json={"name": "x", "target": 0}).status_code == 422
    first = client.post("/api/counters", json={"name": "A"}).json()
    second = client.post("/api/counters", json={"name": "B"}).json()
    assert [c["name"] for c in client.get("/api/counters").json()] == ["A", "B"]
    client.patch(f"/api/counters/{first['id']}", json={"position": second["position"] + 1})
    assert [c["name"] for c in client.get("/api/counters").json()] == ["B", "A"]
    assert client.delete(f"/api/counters/{first['id']}").status_code == 204
    assert client.delete(f"/api/counters/{first['id']}").status_code == 404


def test_counters_survive_a_backup(client):
    client.post("/api/counters", json={"name": "Seeds", "value": 7, "target": 10})
    backup = client.get("/api/backup").json()
    client.delete(f"/api/counters/{backup['counters'][0]['id']}")
    assert client.post("/api/backup", json=backup).status_code == 204
    assert client.get("/api/counters").json()[0]["value"] == 7
