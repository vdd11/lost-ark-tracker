from tests.test_raids import NOW, add_character, complete, task_named


def accounts(client):
    return client.get("/api/accounts").json()


def weekly_gold(client, account_id=None):
    query = f"&account_id={account_id}" if account_id else ""
    return client.get(f"/api/gold/weekly?weeks=1{query}").json()[0]


def test_everyone_starts_on_one_account(client):
    [main] = accounts(client)
    character = add_character(client)
    assert character["account_id"] == main["id"]
    assert accounts(client)[0]["characters"] == 1


def test_event_raids_are_once_per_account(client, set_now):
    set_now(NOW)
    template = client.get("/api/event-raids/template").json()
    event = client.post("/api/event-raids", json={
        "name": "Act 3 Extreme", "ends_on": "2026-10-28", "difficulties": template["difficulties"],
    }).json()
    alt_account = client.post("/api/accounts", json={"name": "Alt account"}).json()

    first = add_character(client, 1775, [{"task_id": event["id"]}], name="First")
    second = add_character(client, 1775, [{"task_id": event["id"]}], name="Second")
    other = add_character(client, 1775, [{"task_id": event["id"]}], name="Other", account_id=alt_account["id"])

    assert complete(client, first["id"], event["id"]).status_code == 204
    assert complete(client, second["id"], event["id"]).status_code == 409
    assert complete(client, other["id"], event["id"]).status_code == 204


def test_weekly_gold_filters_by_account(client, set_now):
    set_now(NOW)
    alt_account = client.post("/api/accounts", json={"name": "Alt account"}).json()
    serca = task_named(client, "Serca")
    main = add_character(client, 1775, [{"task_id": serca["id"]}])
    alt = add_character(client, 1775, [{"task_id": serca["id"]}], name="Alt", account_id=alt_account["id"])
    complete(client, main["id"], serca["id"])
    complete(client, alt["id"], serca["id"])
    client.post("/api/gold-entries", json={"source": "Trade", "amount": 1000, "account_id": alt_account["id"]})
    client.post("/api/gold-entries", json={"source": "Trade", "amount": 500, "character_id": main["id"]})

    everyone = weekly_gold(client)
    alt_only = weekly_gold(client, alt_account["id"])
    main_only = weekly_gold(client, main["account_id"])
    assert alt_only["raid_gold"] + main_only["raid_gold"] == everyone["raid_gold"] > 0
    assert (alt_only["other_gold"], main_only["other_gold"], everyone["other_gold"]) == (1000, 500, 1500)


def test_accounts_can_be_renamed_and_only_empty_ones_deleted(client):
    [main] = accounts(client)
    assert client.delete(f"/api/accounts/{main['id']}").status_code == 409  # the last one

    alt = client.post("/api/accounts", json={"name": "Alt"}).json()
    character = add_character(client, account_id=alt["id"])
    assert client.delete(f"/api/accounts/{alt['id']}").status_code == 409  # has a character

    client.patch(f"/api/characters/{character['id']}", json={"account_id": main["id"]})
    assert client.patch(f"/api/accounts/{alt['id']}", json={"name": "Second"}).json()["name"] == "Second"
    assert client.delete(f"/api/accounts/{alt['id']}").status_code == 204
    assert client.patch(f"/api/characters/{character['id']}", json={"account_id": 999}).status_code == 404


def test_restoring_an_old_backup_creates_an_account(client):
    add_character(client)
    backup = client.get("/api/backup").json()
    del backup["accounts"]
    for row in backup["characters"]:
        row.pop("account_id")
    assert client.post("/api/backup", json=backup).status_code == 204

    [account] = accounts(client)
    assert client.get("/api/characters").json()[0]["account_id"] == account["id"]
