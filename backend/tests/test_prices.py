"""Tools → Prices: built-in items, custom items, and backups."""

from datetime import datetime

from price_items import PRICE_ITEMS

NOW = datetime(2026, 10, 4, 12, 0)


def by_key(client):
    return {p["key"]: p for p in client.get("/api/prices").json()}


def test_built_in_items_start_without_prices(client):
    prices = client.get("/api/prices").json()
    assert [p["key"] for p in prices] == [item.key for item in PRICE_ITEMS]
    assert all(p["price"] is None and p["unit_price"] is None and p["builtin"] for p in prices)


def test_setting_a_price_records_when(client, set_now):
    set_now(NOW)
    key = PRICE_ITEMS[0].key
    updated = client.patch(f"/api/prices/{key}", json={"price": 250, "per": 100}).json()
    assert updated["unit_price"] == 2.5
    assert updated["updated_at"].startswith("2026-10-04T12:00")
    # Changing only the bundle size keeps the date and recomputes the unit price.
    assert client.patch(f"/api/prices/{key}", json={"per": 10}).json()["unit_price"] == 25


def test_built_in_names_are_fixed_and_reset_clears_them(client):
    key = PRICE_ITEMS[0].key
    assert client.patch(f"/api/prices/{key}", json={"name": "Mine"}).status_code == 400
    client.patch(f"/api/prices/{key}", json={"price": 5, "hidden": True})
    assert client.delete(f"/api/prices/{key}").status_code == 204
    assert by_key(client)[key]["price"] is None
    assert by_key(client)[key]["hidden"] is False


def test_custom_items(client):
    created = client.post("/api/prices", json={"name": " Guild token ", "price": 30}).json()
    assert created["key"] == "custom-1" and created["name"] == "Guild token" and not created["builtin"]
    assert client.post("/api/prices", json={"name": "Other"}).json()["key"] == "custom-2"
    client.patch("/api/prices/custom-1", json={"name": "Guild coin"})
    assert by_key(client)["custom-1"]["name"] == "Guild coin"
    client.delete("/api/prices/custom-1")
    assert "custom-1" not in by_key(client)
    assert client.patch("/api/prices/custom-9", json={"price": 1}).status_code == 404


def test_rejects_negative_prices_and_zero_bundles(client):
    key = PRICE_ITEMS[0].key
    assert client.patch(f"/api/prices/{key}", json={"price": -1}).status_code == 422
    assert client.patch(f"/api/prices/{key}", json={"per": 0}).status_code == 422


def test_prices_survive_a_backup_and_restore(client):
    key = PRICE_ITEMS[0].key
    client.patch(f"/api/prices/{key}", json={"price": 99})
    client.post("/api/prices", json={"name": "Guild token", "price": 30})
    backup = client.get("/api/backup").json()
    assert {row["key"] for row in backup["market_prices"]} == {key, "custom-1"}

    client.delete(f"/api/prices/{key}")
    client.delete("/api/prices/custom-1")
    assert client.post("/api/backup", json=backup).status_code == 204
    prices = by_key(client)
    assert prices[key]["price"] == 99 and prices["custom-1"]["name"] == "Guild token"


def test_prices_export_as_csv(client):
    client.post("/api/prices", json={"name": "Guild token", "price": 30, "per": 4})
    lines = client.get("/api/export/prices.csv").text.splitlines()
    assert lines[0] == "item,price,per,gold_per_unit,updated,kind"
    assert any(line.startswith("Guild token,30,4,7.5,") and line.endswith(",custom") for line in lines)
