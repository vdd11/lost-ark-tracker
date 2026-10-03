"""Last week at a glance, for the tracker's new-week recap."""

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Completion, Task
from resets import utc_now, week_of
from schemas import WeekRecap

router = APIRouter(prefix="/api")


@router.get("/recap", response_model=WeekRecap)
def get_recap(db: Session = Depends(get_db)):
    """Paying raid clears per character in the week before this one (event
    raids don't use a gold slot, so they're left out)."""
    last_week = week_of(utc_now()) - timedelta(days=7)
    paid = (
        db.query(Completion.character_id, func.count(Completion.id))
        .join(Task, Task.id == Completion.task_id)
        .filter(
            Completion.period == last_week,
            Completion.gold > 0,
            Completion.character_id.is_not(None),
            Task.category == "raid",
            Task.gold_for_everyone.is_(False),
        )
        .group_by(Completion.character_id)
        .all()
    )
    return WeekRecap(week=last_week, paid_raids=dict(paid))
