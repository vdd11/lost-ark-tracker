"""The backup file format (Settings → Download backup / Restore).

A backup is JSON: {"app", "format", "exported_at", "<table>": [rows...]} for
every table in BACKUP_MODELS. When backed-up data changes in a way old files
can't just be read as (a new table is fine: it's missing from old files and
restores empty; a renamed column or a changed meaning is not):

1. bump BACKUP_FORMAT,
2. add UPGRADES[old] = upgrade_vOLD_to_vNEW, which rewrites an old file's dict
   into the new shape, e.g.

       def upgrade_v1_to_v2(backup: dict) -> dict:
           for row in backup.get("characters", []):
               row["roster_id"] = row.pop("account_id", 1)
           return backup

3. commit a new fixture (tests/fixtures/make_backup_fixture.py); keep the old
   ones, whose tests restore them through every upgrade step.
"""

from collections.abc import Callable
from datetime import date, datetime

from sqlalchemy import Date, DateTime

from models import (
    Account,
    BalanceCheck,
    Character,
    CharacterTask,
    Completion,
    GemEntry,
    GoldEntry,
    MarketPrice,
    RaidDifficulty,
    Task,
)
from version import APP_NAME

# Restore order: parents before children. Deletes run in reverse.
BACKUP_MODELS = {
    "accounts": Account,
    "characters": Character,
    "tasks": Task,
    "raid_difficulties": RaidDifficulty,
    "character_tasks": CharacterTask,
    "completions": Completion,
    "gold_entries": GoldEntry,
    "gem_entries": GemEntry,
    "balance_checks": BalanceCheck,
    "market_prices": MarketPrice,
}
BACKUP_FORMAT = 1

# format N -> a function turning a format-N backup into format N + 1.
UPGRADES: dict[int, Callable[[dict], dict]] = {}


class BackupError(ValueError):
    """A file that can't be restored, with a message for the person restoring it."""


def upgrade_backup(backup: object) -> dict:
    """Check a backup and bring it up to BACKUP_FORMAT, one step at a time."""
    if not isinstance(backup, dict) or backup.get("app") != APP_NAME:
        raise BackupError("This isn't a Lost Ark Tracker backup file.")
    version = backup.get("format")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise BackupError("This isn't a Lost Ark Tracker backup file.")
    if version > BACKUP_FORMAT:
        raise BackupError(
            f"This backup was made by a newer version of {APP_NAME} (format {version}). "
            "Update the app to restore it."
        )
    while version < BACKUP_FORMAT:
        step = UPGRADES.get(version)
        if step is None:
            raise BackupError(f"Can't upgrade a format {version} backup: no upgrade step for it.")
        backup = step(backup)
        version += 1
        backup["format"] = version
    return backup


def serialize_row(row) -> dict:
    values = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        values[column.name] = value.isoformat() if isinstance(value, (date, datetime)) else value
    return values


def deserialize_row(model, values: dict):
    kwargs = {}
    for column in model.__table__.columns:
        if column.name not in values:
            continue
        value = values[column.name]
        if value is not None and isinstance(column.type, DateTime):
            value = datetime.fromisoformat(value)
        elif value is not None and isinstance(column.type, Date):
            value = date.fromisoformat(value)
        kwargs[column.name] = value
    return model(**kwargs)
