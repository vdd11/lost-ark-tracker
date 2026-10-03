"""Limited-time event raids (Extreme)."""


from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import RaidDifficulty, Task
from schemas import (
    DifficultyCreate,
    EventRaidCreate,
    EventTemplate,
    TaskRead,
)
from raids import EVENT_NOTE, EXTREME_BASES, EXTREME_TEMPLATE
from routes.common import next_position
from routes.tasks import read_task

router = APIRouter(prefix="/api")


@router.get("/event-raids/template", response_model=EventTemplate)
def get_event_template():
    return EventTemplate(
        bases=EXTREME_BASES,
        difficulties=[
            DifficultyCreate(name=name, min_item_level=item_level, gold=gold)
            for name, item_level, gold in EXTREME_TEMPLATE
        ],
    )


@router.post("/event-raids", response_model=TaskRead, status_code=201)
def create_event_raid(data: EventRaidCreate, db: Session = Depends(get_db)):
    """A limited-time raid such as "Act 3 Extreme": one clear per roster, gold for anyone."""
    task = Task(
        name=data.name,
        category="raid",
        ends_on=data.ends_on,
        roster_limited=True,
        gold_for_everyone=True,
        note=EVENT_NOTE,
        position=next_position(db, Task),
    )
    db.add(task)
    db.flush()
    for position, difficulty in enumerate(data.difficulties):
        db.add(RaidDifficulty(task_id=task.id, position=position, **difficulty.model_dump()))
    db.commit()
    db.refresh(task)
    return read_task(db, task)
