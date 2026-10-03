import csv
import io
from datetime import datetime

from tests.test_raids import add_character, complete, task_named


def rows(response):
    assert response.headers["content-type"].startswith("text/csv")
    return list(csv.DictReader(io.StringIO(response.text)))


def test_gold_csv_has_raid_clears_and_logged_gold(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    main = add_character(client, 1775, name="Moonfall")
    serca = task_named(client, "Serca")
    complete(client, main["id"], serca["id"])
    client.post("/api/gold-entries", json={"source": "Field Boss", "amount": 1500, "note": "Sunday"})

    gold = rows(client.get("/api/export/gold.csv"))
    assert [(r["kind"], r["source"], r["character"], r["gold"]) for r in gold] == [
        ("raid", "Serca", "Moonfall", "54000"),
        ("logged", "Field Boss", "", "1500"),
    ]
    assert gold[0]["week"] == "2026-09-30" and gold[1]["note"] == "Sunday"


def test_gems_csv_has_one_row_per_gem_level(client, set_now):
    set_now(datetime(2026, 10, 2, 12))
    main = add_character(client, 1775, name="Moonfall")
    cube = task_named(client, "Ebony Cube")
    complete(client, main["id"], cube["id"], count=2)
    client.post("/api/gem-entries", json={"source": "Field Boss", "gems": {"1": 3, "3": 1}})

    gems = rows(client.get("/api/export/gems.csv"))
    assert [(r["kind"], r["source"], r["gem_level"], r["count"], r["lv1_equivalent"]) for r in gems] == [
        ("tracked", "Ebony Cube", "2", "44", "132"),
        ("logged", "Field Boss", "1", "3", "3"),
        ("logged", "Field Boss", "3", "1", "9"),
    ]
