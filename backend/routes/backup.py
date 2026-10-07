"""Export and restore all data as JSON (format and upgrades: backups.py)."""

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from accounts import ensure_accounts
from backups import BACKUP_FORMAT, BACKUP_MODELS, BackupError, deserialize_row, serialize_row, upgrade_backup
from database import get_db
from raids import sync_catalog
from resets import utc_now
from seed import seed_default_tasks
from version import APP_NAME

router = APIRouter(prefix="/api")


@router.get("/backup")
def export_backup(db: Session = Depends(get_db)):
    backup = {"app": APP_NAME, "format": BACKUP_FORMAT, "exported_at": utc_now().isoformat()}
    for key, model in BACKUP_MODELS.items():
        backup[key] = [serialize_row(row) for row in db.query(model).all()]
    return backup


@router.post("/backup", status_code=204)
def restore_backup(backup: dict = Body(...), db: Session = Depends(get_db)):
    """Replace all data with the contents of a backup file (older formats are upgraded first)."""
    try:
        backup = upgrade_backup(backup)
    except BackupError as error:
        raise HTTPException(status_code=400, detail=str(error))

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
    # Backups from before accounts have none; put everyone on one.
    ensure_accounts(db)

    return Response(status_code=204)


@router.post("/reset", status_code=204)
def reset_everything(db: Session = Depends(get_db)):
    """Delete all data and start again as a new install: the default tasks,
    the built-in raids and one account. (The page downloads a backup first, so
    Undo can restore it.)"""
    for model in reversed(BACKUP_MODELS.values()):
        db.query(model).delete()
    db.commit()
    seed_default_tasks(db)
    ensure_accounts(db)
    sync_catalog(db)
    return Response(status_code=204)
