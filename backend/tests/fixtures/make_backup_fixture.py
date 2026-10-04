"""Write a backup fixture covering every backed-up table.

    cd backend && .venv/Scripts/python tests/fixtures/make_backup_fixture.py

Drives the app through its API on a throwaway database with a fixed clock and
saves the export as backup-format-<BACKUP_FORMAT>.json next to this file.
Never touches a real database. Run it when BACKUP_FORMAT changes (see
backups.py) and keep the older fixtures.
"""

import json
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent.parent
NOW = datetime(2026, 9, 30, 12)  # a Wednesday, after the weekly reset

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'fixture.db'}"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from backups import BACKUP_FORMAT  # noqa: E402


def freeze_clock():
    for name, module in list(sys.modules.items()):
        if (name == "main" or name.startswith("routes.")) and hasattr(module, "utc_now"):
            module.utc_now = lambda: NOW


def build(client: TestClient) -> dict:
    tasks = {t["name"]: t for t in client.get("/api/tasks").json()}
    tier = lambda task, name: next(d["id"] for d in tasks[task]["difficulties"] if d["name"] == name)  # noqa: E731
    raid = lambda task, name: {"task_id": tasks[task]["id"], "difficulty_id": tier(task, name)}  # noqa: E731

    main_account = client.get("/api/accounts").json()[0]
    alt_account = client.post("/api/accounts", json={"name": "Alt roster"}).json()

    def character(name, class_name, item_level, raids, account, gold_earner=True):
        return client.post("/api/characters", json={
            "name": name, "class_name": class_name, "item_level": item_level, "is_gold_earner": gold_earner,
            "account_id": account["id"], "raids": raids,
        }).json()

    bard = character("Bardy", "Bard", 1770, [
        raid("Serca", "Nightmare"), raid("Horizon Cathedral", "Lv3"), raid("The Final Day", "Hard"),
    ], main_account)
    slayer = character("Slayer", "Slayer", 1745, [raid("Serca", "Hard"), raid("Act 4", "Hard")], main_account)
    artist = character("Painty", "Artist", 1725, [raid("The Final Day", "Normal")], alt_account, gold_earner=False)

    def complete(who, task, **body):
        response = client.put(f"/api/characters/{who['id']}/tasks/{tasks[task]['id']}/completion", json=body or None)
        assert response.status_code == 204, response.text

    complete(bard, "Serca")
    complete(bard, "The Final Day", bought_bonus=True)
    complete(bard, "Haal's Hourglass", sands=2, lucky_rooms=1)
    complete(bard, "Ebony Cube", tier_counts={tier("Ebony Cube", "4th"): 2, tier("Ebony Cube", "2nd"): 1})
    complete(bard, "Chaos Dungeon")
    complete(slayer, "Act 4")
    complete(artist, "The Final Day")
    client.put(f"/api/characters/{slayer['id']}/tasks/{tasks['Chaos Dungeon']['id']}/rest", json={"value": 80})

    client.post("/api/gold-entries", json={"source": "Field Boss", "amount": 1500, "character_id": bard["id"]})
    client.post("/api/gold-entries", json={
        "source": "Trade", "amount": 25000, "account_id": alt_account["id"], "note": "sold books",
        "earned_at": "2026-09-29T18:00:00",
    })
    client.post("/api/gem-entries", json={"source": "Guardian Raid", "character_id": slayer["id"], "gems": {"3": 2, "2": 5}})
    client.post("/api/balances", json={
        "tradeable": 120000, "roster_bound": 30000, "character_bound": {str(bard["id"]): 50000},
        "account_id": main_account["id"], "note": "weekly check-in",
    })

    backup = client.get("/api/backup").json()
    backup["exported_at"] = NOW.isoformat()
    return backup


if __name__ == "__main__":
    with TestClient(main.app) as client:
        freeze_clock()
        backup = build(client)
    path = HERE / f"backup-format-{BACKUP_FORMAT}.json"
    path.write_text(json.dumps(backup, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    counts = {key: len(rows) for key, rows in backup.items() if isinstance(rows, list)}
    print(f"Wrote {path.name}: {counts}")
