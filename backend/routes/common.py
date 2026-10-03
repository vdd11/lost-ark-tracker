"""Helpers shared by the route modules."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from resets import utc_now


def get_or_404(db: Session, model, item_id: int):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return item


def next_position(db: Session, model) -> int:
    highest = db.query(func.max(model.position)).scalar()
    return 0 if highest is None else highest + 1


def to_naive_utc(moment: datetime | None) -> datetime:
    """Entries default to now; explicit times are stored as naive UTC."""
    if moment is None:
        return utc_now()
    if moment.tzinfo is not None:
        return moment.astimezone(timezone.utc).replace(tzinfo=None)
    return moment
