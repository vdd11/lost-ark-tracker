"""Export and restore all data as JSON."""

from datetime import date, datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from sqlalchemy import Date, DateTime
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models import BalanceCheck, Character, CharacterTask, Completion, GemEntry, GoldEntry, RaidDifficulty, Task
from resets import utc_now
from version import APP_NAME

router = APIRouter(prefix="/api")


# Restore order: parents before children. Deletes run in reverse.
BACKUP_MODELS = {
    "characters": Character,
    "tasks": Task,
    "raid_difficulties": RaidDifficulty,
    "character_tasks": CharacterTask,
    "completions": Completion,
    "gold_entries": GoldEntry,
    "gem_entries": GemEntry,
    "balance_checks": BalanceCheck,
}
BACKUP_FORMAT = 1


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


@router.get("/backup")
def export_backup(db: Session = Depends(get_db)):
    backup = {"app": APP_NAME, "format": BACKUP_FORMAT, "exported_at": utc_now().isoformat()}
    for key, model in BACKUP_MODELS.items():
        backup[key] = [serialize_row(row) for row in db.query(model).all()]
    return backup


@router.post("/backup", status_code=204)
def restore_backup(backup: dict = Body(...), db: Session = Depends(get_db)):
    """Replace all data with the contents of a backup file."""
    if backup.get("app") != APP_NAME or backup.get("format") != BACKUP_FORMAT:
        raise HTTPException(status_code=400, detail="This isn't a Lost Ark Tracker backup file.")

    try:
        for model in reversed(BACKUP_MODELS.values()):
            db.query(model).delete()
        for key, model in BACKUP_MODELS.items():
            rows = backup.get(key, [])
            if not isinstance(rows, list):
                raise ValueError(f"'{key}' should be a list")
            db.add_all(deserialize_row(model, values) for values in rows)
            db.flush()
        db.commit()
    except (ValueError, TypeError, AttributeError, SQLAlchemyError) as error:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Backup file is invalid: {error}")

    return Response(status_code=204)
