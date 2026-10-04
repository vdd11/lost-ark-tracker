"""Honing plans: saved per character, validated, backed up."""

from datetime import datetime

from tests.test_raids import add_character

STEP = {"id": "a", "label": "Armor +14", "count": 5, "chance": 30, "chanceStep": 3, "guaranteedBy": 8,
        "materials": {"destiny-guardian-stone": 1200}, "gold": 2000, "silver": 90000}


def plan_body(**extra):
    return {"target_item_level": 1720, "notes": " armor first ", "plan": {"steps": [STEP], "owned": {"destiny-guardian-stone": 5000}}, **extra}


def test_save_read_and_delete_a_plan(client, set_now):
    main = add_character(client, 1700, [], name="Main")
    set_now(datetime(2026, 10, 4, 12))
    saved = client.put(f"/api/honing-plans/{main['id']}", json=plan_body()).json()
    assert saved["start_item_level"] == 1700 and saved["target_item_level"] == 1720
    assert saved["notes"] == "armor first" and saved["bound_mode"] == "roster"
    assert saved["plan"]["steps"][0]["materials"] == {"destiny-guardian-stone": 1200}
    assert saved["plan"]["steps"][0]["chanceCap"] is None

    assert [p["character_id"] for p in client.get("/api/honing-plans").json()] == [main["id"]]
    assert client.delete(f"/api/honing-plans/{main['id']}").status_code == 204
    assert client.get("/api/honing-plans").json() == []


def test_a_new_target_restarts_the_progress_line(client):
    main = add_character(client, 1700, [], name="Main")
    client.put(f"/api/honing-plans/{main['id']}", json=plan_body())
    client.patch(f"/api/characters/{main['id']}", json={"item_level": 1710})
    # Same target: progress keeps counting from 1700.
    assert client.put(f"/api/honing-plans/{main['id']}", json=plan_body()).json()["start_item_level"] == 1700
    # New target: counts from where the character is now.
    assert client.put(f"/api/honing-plans/{main['id']}", json=plan_body(target_item_level=1730)).json()["start_item_level"] == 1710


def test_rejects_impossible_values(client):
    main = add_character(client, 1700, [], name="Main")
    url = f"/api/honing-plans/{main['id']}"
    assert client.put(url, json=plan_body(plan={"steps": [{**STEP, "chance": 120}]})).status_code == 422
    assert client.put(url, json=plan_body(plan={"steps": [{**STEP, "materials": {"x": -1}}]})).status_code == 422
    assert client.put(url, json=plan_body(bound_mode="everything")).status_code == 422
    assert client.put("/api/honing-plans/999", json=plan_body()).status_code == 404


def test_plans_go_with_their_character_and_into_backups(client):
    main = add_character(client, 1700, [], name="Main")
    client.put(f"/api/honing-plans/{main['id']}", json=plan_body())
    backup = client.get("/api/backup").json()
    assert backup["honing_plans"][0]["plan"]["steps"][0]["id"] == "a"

    client.delete(f"/api/characters/{main['id']}")
    assert client.get("/api/honing-plans").json() == []
    assert client.post("/api/backup", json=backup).status_code == 204
    assert client.get("/api/honing-plans").json()[0]["target_item_level"] == 1720


def test_plans_export_as_csv(client):
    main = add_character(client, 1700, [], name="Main")
    client.put(f"/api/honing-plans/{main['id']}", json=plan_body())
    lines = client.get("/api/export/honing-plans.csv").text.splitlines()
    assert lines[0].startswith("character,start_item_level,target_item_level,step,times,chance_percent")
    assert lines[1] == "Main,1700,1720,Armor +14,5,30,3,,8,2000,90000,Destiny Crystallized Guardian Stone x1200,armor first"
