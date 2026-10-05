from datetime import date

import database


def test_daily_backup_is_kept_and_pruned(client):
    client.post("/api/characters", json={"name": "Main", "class_name": "Bard"})
    source = database.engine.url.database
    folder = database.Path(source).parent / "backups"
    for old in folder.glob("*.db"):
        old.unlink()

    first = database.backup_database(date(2026, 1, 1))
    assert first.name.endswith("-2026-01-01.db") and first.stat().st_size > 0
    assert database.backup_database(date(2026, 1, 1)) == first  # once per day

    for day in range(2, 15):
        database.backup_database(date(2026, 1, day))
    kept = sorted(p.name for p in folder.glob("*.db"))
    assert len(kept) == database.BACKUPS_TO_KEEP
    assert kept[0].endswith("2026-01-05.db") and kept[-1].endswith("2026-01-14.db")


def test_backups_with_old_honing_plans_still_restore(client):
    """The honing planner is gone (1.18), but backups made with it restore with nothing lost."""
    main = client.post("/api/characters", json={"name": "Main", "class_name": "Bard", "item_level": 1700}).json()
    backup = client.get("/api/backup").json()
    backup["honing_plans"] = [{
        "character_id": main["id"], "start_item_level": 1700, "target_item_level": 1720, "notes": "weapon",
        "plan": {"steps": [{"id": "a", "chance": 50}], "owned": {}}, "bound_mode": "all",
        "updated_at": "2026-10-01T12:00:00",
    }]
    assert client.post("/api/backup", json=backup).status_code == 204
    assert client.get("/api/backup").json()["honing_plans"][0]["notes"] == "weapon"
    assert client.get("/api/honing-plans").status_code == 404
