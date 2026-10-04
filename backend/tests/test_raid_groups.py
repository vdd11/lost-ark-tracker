"""Raid groups: create, edit, member cleanup, validation, backups."""

from tests.test_raids import task_named


def test_create_edit_and_delete_a_group(client):
    serca = task_named(client, "Serca")
    group = client.post(
        "/api/raid-groups",
        json={"name": " Wednesday static ", "task_id": serca["id"], "schedule": "Wed 20:00", "members": ["Bardy", " Tanky ", "", "Bardy"]},
    ).json()
    assert group["name"] == "Wednesday static"
    assert group["members"] == ["Bardy", "Tanky"]

    url = f"/api/raid-groups/{group['id']}"
    edited = client.patch(url, json={"schedule": None, "members": ["Bardy", "Healy"]}).json()
    assert (edited["schedule"], edited["members"], edited["task_id"]) == (None, ["Bardy", "Healy"], serca["id"])
    assert client.patch(url, json={"name": None}).json()["name"] == "Wednesday static"

    assert client.delete(url).status_code == 204
    assert client.get("/api/raid-groups").json() == []


def test_rejects_unknown_raids_and_too_many_members(client):
    assert client.post("/api/raid-groups", json={"name": "x", "task_id": 9999}).status_code == 404
    assert client.post("/api/raid-groups", json={"name": "x", "members": [f"p{i}" for i in range(17)]}).status_code == 422
    assert client.post("/api/raid-groups", json={"name": ""}).status_code == 422


def test_groups_survive_a_backup(client):
    client.post("/api/raid-groups", json={"name": "Static", "members": ["Bardy"]})
    backup = client.get("/api/backup").json()
    client.delete(f"/api/raid-groups/{backup['raid_groups'][0]['id']}")
    assert client.post("/api/backup", json=backup).status_code == 204
    assert client.get("/api/raid-groups").json()[0]["members"] == ["Bardy"]


def test_deleting_a_custom_raid_keeps_the_group(client):
    custom = client.post("/api/tasks", json={"name": "Custom Raid", "category": "raid"}).json()
    group = client.post("/api/raid-groups", json={"name": "Static", "task_id": custom["id"]}).json()
    client.delete(f"/api/tasks/{custom['id']}")
    assert client.get("/api/raid-groups").json()[0] == {**group, "task_id": None}
