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
