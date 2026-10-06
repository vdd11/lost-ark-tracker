import copy
import json
from pathlib import Path

import pytest

import backups

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def fixture(version: int) -> dict:
    return json.loads((FIXTURES / f"backup-format-{version}.json").read_text(encoding="utf-8"))


def tables(backup: dict) -> dict:
    # Tables added after a fixture was made are missing from it and restore empty.
    return {key: backup.get(key, []) for key in backups.BACKUP_MODELS}


def test_format_1_fixture_restores_every_table(client):
    original = fixture(1)
    assert client.post("/api/backup", json=original).status_code == 204

    restored = client.get("/api/backup").json()
    # A round trip: what comes back out is exactly what went in. Columns added
    # since the fixture was made (additive, no format bump) come back as their
    # defaults, so only the fixture's own columns are compared.
    def fixture_columns(backup):
        result = {}
        for key, rows in tables(backup).items():
            columns = original[key][0].keys() if original.get(key) else ()
            result[key] = [{column: row.get(column) for column in columns} for row in rows]
        return result

    assert fixture_columns(restored) == fixture_columns(original)
    added = {
        (key, column)
        for key, rows in tables(restored).items()
        if rows and original.get(key)
        for column in rows[0]
        if column not in original[key][0]
    }
    assert all(row[column] in (None, 0, False, "", [], {}) for key, column in added for row in restored[key])
    old_tables = [key for key in backups.BACKUP_MODELS if key in original]
    assert all(original[key] for key in old_tables), "the fixture should cover every table it has"
    assert all(restored[key] == [] for key in backups.BACKUP_MODELS if key not in original)

    characters = {c["name"]: c for c in client.get("/api/characters").json()}
    accounts = {a["id"]: a["name"] for a in client.get("/api/accounts").json()}
    assert accounts[characters["Painty"]["account_id"]] == "Alt roster"
    assert characters["Bardy"]["account_id"] != characters["Painty"]["account_id"]

    completions = restored["completions"]
    bonus = next(c for c in completions if c["bonus_spent"])
    assert (bonus["gold"], bonus["bonus_spent"]) == (48000, 15360)
    assert any(c["tier_counts"] for c in completions)
    assert any(c["sands"] == 2 and c["lucky_rooms"] == 1 for c in completions)
    assert restored["balance_checks"][0]["character_bound"] == {str(characters["Bardy"]["id"]): 50000}
    assert {e["earned_at"] for e in restored["gold_entries"]} >= {"2026-09-29T18:00:00"}


def test_backups_upgrade_one_format_at_a_time(monkeypatch):
    steps = []

    def v1_to_v2(backup):
        steps.append(2)
        backup["characters"][0]["renamed"] = True
        return backup

    def v2_to_v3(backup):
        steps.append(3)
        return backup

    monkeypatch.setattr(backups, "BACKUP_FORMAT", 3)
    monkeypatch.setattr(backups, "UPGRADES", {1: v1_to_v2, 2: v2_to_v3})
    upgraded = backups.upgrade_backup(copy.deepcopy(fixture(1)))
    assert upgraded["format"] == 3 and steps == [2, 3]
    assert upgraded["characters"][0]["renamed"] is True

    monkeypatch.setattr(backups, "UPGRADES", {1: v1_to_v2})
    with pytest.raises(backups.BackupError, match="no upgrade step"):
        backups.upgrade_backup(copy.deepcopy(fixture(1)))


def test_newer_and_foreign_files_are_refused_clearly(client):
    newer = {**fixture(1), "format": backups.BACKUP_FORMAT + 1}
    response = client.post("/api/backup", json=newer)
    assert response.status_code == 400 and "newer version" in response.json()["detail"]

    for junk in ({"app": "Something else", "format": 1}, {"app": "Lost Ark Tracker", "format": "1"}, {"hello": 1}):
        response = client.post("/api/backup", json=junk)
        assert response.status_code == 400 and "isn't a Lost Ark Tracker backup" in response.json()["detail"]
