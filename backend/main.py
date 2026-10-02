from contextlib import asynccontextmanager
from datetime import timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, SessionLocal, add_missing_columns, engine, get_db
from models import Character, CharacterTask, Completion, GoldEntry, Task
from resets import daily_reset_before, period_for, utc_now, week_of, weekly_reset_before
from schemas import (
    CharacterCreate,
    CharacterRead,
    CharacterUpdate,
    GoldEntryCreate,
    GoldEntryRead,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    TrackerState,
    WeeklyGold,
)
from seed import seed_default_tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any new tables, upgrade existing ones, and add the default tasks.
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
    with SessionLocal() as db:
        seed_default_tasks(db)
    yield


app = FastAPI(lifespan=lifespan)

# Allow the Next.js frontend to communicate with our API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_or_404(db: Session, model, item_id: int):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return item


def next_position(db: Session, model) -> int:
    highest = db.query(func.max(model.position)).scalar()
    return 0 if highest is None else highest + 1


@app.get("/")
def root():
    return {"message": "Lost Ark Tracker API is running!"}


# ---------- Characters ----------

def to_character_read(character: Character, task_ids: list[int]) -> CharacterRead:
    return CharacterRead.model_validate(character).model_copy(update={"task_ids": task_ids})


@app.get("/characters", response_model=list[CharacterRead])
def get_characters(db: Session = Depends(get_db)):
    characters = db.query(Character).order_by(Character.position, Character.id).all()

    task_ids_by_character: dict[int, list[int]] = {}
    for assignment in db.query(CharacterTask).all():
        task_ids_by_character.setdefault(assignment.character_id, []).append(assignment.task_id)

    return [to_character_read(c, task_ids_by_character.get(c.id, [])) for c in characters]


@app.post("/characters", response_model=CharacterRead, status_code=201)
def create_character(character_data: CharacterCreate, db: Session = Depends(get_db)):
    character = Character(
        **character_data.model_dump(),
        position=next_position(db, Character),
    )
    if not character.reserved_for:
        character.reserved_for = None

    db.add(character)
    db.flush()

    # New characters start with every daily and weekly; raids are opted into
    # per character since they depend on item level.
    task_ids = [
        task.id
        for task in db.query(Task).filter(Task.category.in_(["daily", "weekly"])).all()
    ]
    for task_id in task_ids:
        db.add(CharacterTask(character_id=character.id, task_id=task_id))

    db.commit()
    db.refresh(character)

    return to_character_read(character, task_ids)


@app.patch("/characters/{character_id}", response_model=CharacterRead)
def update_character(character_id: int, changes: CharacterUpdate, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)

    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    if not character.reserved_for:
        character.reserved_for = None

    db.commit()
    db.refresh(character)

    task_ids = [
        a.task_id
        for a in db.query(CharacterTask).filter(CharacterTask.character_id == character_id)
    ]
    return to_character_read(character, task_ids)


@app.delete("/characters/{character_id}", status_code=204)
def delete_character(character_id: int, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)

    db.query(CharacterTask).filter(CharacterTask.character_id == character_id).delete()
    # Keep gold history, just detach it from the deleted character.
    db.query(Completion).filter(Completion.character_id == character_id).update({"character_id": None})
    db.query(GoldEntry).filter(GoldEntry.character_id == character_id).update({"character_id": None})
    db.delete(character)
    db.commit()

    return Response(status_code=204)


@app.put("/characters/{character_id}/tasks/{task_id}", status_code=204)
def assign_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    get_or_404(db, Character, character_id)
    get_or_404(db, Task, task_id)

    if db.get(CharacterTask, (character_id, task_id)) is None:
        db.add(CharacterTask(character_id=character_id, task_id=task_id))
        db.commit()

    return Response(status_code=204)


@app.delete("/characters/{character_id}/tasks/{task_id}", status_code=204)
def unassign_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    assignment = db.get(CharacterTask, (character_id, task_id))
    if assignment is not None:
        db.delete(assignment)
        db.commit()

    return Response(status_code=204)


# ---------- Tasks ----------

@app.get("/tasks", response_model=list[TaskRead])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.position, Task.id).all()


@app.post("/tasks", response_model=TaskRead, status_code=201)
def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**task_data.model_dump(), position=next_position(db, Task))
    db.add(task)
    db.flush()

    # Like new characters, dailies and weeklies apply to everyone by default.
    if task.category != "raid":
        for character in db.query(Character).all():
            db.add(CharacterTask(character_id=character.id, task_id=task.id))

    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, changes: TaskUpdate, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)

    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)

    db.query(CharacterTask).filter(CharacterTask.task_id == task_id).delete()
    db.query(Completion).filter(Completion.task_id == task_id).update({"task_id": None})
    db.delete(task)
    db.commit()

    return Response(status_code=204)


# ---------- Tracker (check-offs) ----------

@app.get("/tracker", response_model=TrackerState)
def get_tracker(db: Session = Depends(get_db)):
    now = utc_now()
    daily_reset = daily_reset_before(now)
    weekly_reset = weekly_reset_before(now)

    rows = (
        db.query(Completion.character_id, Completion.task_id, Completion.period, Task.category)
        .join(Task, Task.id == Completion.task_id)
        .filter(Completion.character_id.is_not(None))
        .filter(Completion.period >= weekly_reset.date())
        .all()
    )
    completed = [
        (character_id, task_id)
        for character_id, task_id, period, category in rows
        if period == period_for(category, now)
    ]

    return TrackerState(
        daily_period=daily_reset.date(),
        weekly_period=weekly_reset.date(),
        next_daily_reset=daily_reset + timedelta(days=1),
        next_weekly_reset=weekly_reset + timedelta(days=7),
        completed=completed,
    )


@app.put("/characters/{character_id}/tasks/{task_id}/completion", status_code=204)
def complete_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)
    task = get_or_404(db, Task, task_id)

    now = utc_now()
    period = period_for(task.category, now)

    existing = (
        db.query(Completion)
        .filter_by(character_id=character_id, task_id=task_id, period=period)
        .first()
    )
    if existing is None:
        db.add(Completion(
            character_id=character_id,
            task_id=task_id,
            period=period,
            completed_at=now,
            # Only gold-earning characters get gold from their clears.
            gold=task.gold if character.is_gold_earner else 0,
        ))
        db.commit()

    return Response(status_code=204)


@app.delete("/characters/{character_id}/tasks/{task_id}/completion", status_code=204)
def uncomplete_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)
    period = period_for(task.category, utc_now())

    db.query(Completion).filter_by(
        character_id=character_id, task_id=task_id, period=period
    ).delete()
    db.commit()

    return Response(status_code=204)


# ---------- Gold ----------

@app.get("/gold-entries", response_model=list[GoldEntryRead])
def get_gold_entries(limit: int = Query(default=100, le=1000), db: Session = Depends(get_db)):
    return (
        db.query(GoldEntry)
        .order_by(GoldEntry.earned_at.desc(), GoldEntry.id.desc())
        .limit(limit)
        .all()
    )


@app.post("/gold-entries", response_model=GoldEntryRead, status_code=201)
def create_gold_entry(entry_data: GoldEntryCreate, db: Session = Depends(get_db)):
    if entry_data.character_id is not None:
        get_or_404(db, Character, entry_data.character_id)

    values = entry_data.model_dump()
    earned_at = values.pop("earned_at")
    if earned_at is None:
        earned_at = utc_now()
    elif earned_at.tzinfo is not None:
        earned_at = earned_at.astimezone(timezone.utc).replace(tzinfo=None)

    entry = GoldEntry(**values, earned_at=earned_at)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/gold-entries/{entry_id}", status_code=204)
def delete_gold_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = get_or_404(db, GoldEntry, entry_id)
    db.delete(entry)
    db.commit()
    return Response(status_code=204)


@app.get("/gold/weekly", response_model=list[WeeklyGold])
def get_weekly_gold(weeks: int = Query(default=12, ge=1, le=104), db: Session = Depends(get_db)):
    """Gold per reset week, oldest first: raid clears plus manually logged gold."""
    current_week = week_of(utc_now())
    week_starts = [current_week - timedelta(weeks=i) for i in reversed(range(weeks))]
    first_reset = weekly_reset_before(utc_now()) - timedelta(weeks=weeks - 1)

    totals = {
        week: WeeklyGold(week=week, raid_gold=0, other_gold=0, total=0, by_source={})
        for week in week_starts
    }

    completions = (
        db.query(Completion)
        .filter(Completion.completed_at >= first_reset, Completion.gold > 0)
        .all()
    )
    for completion in completions:
        bucket = totals.get(week_of(completion.completed_at))
        if bucket is not None:
            bucket.raid_gold += completion.gold

    entries = db.query(GoldEntry).filter(GoldEntry.earned_at >= first_reset).all()
    for entry in entries:
        bucket = totals.get(week_of(entry.earned_at))
        if bucket is not None:
            bucket.other_gold += entry.amount
            bucket.by_source[entry.source] = bucket.by_source.get(entry.source, 0) + entry.amount

    for bucket in totals.values():
        bucket.total = bucket.raid_gold + bucket.other_gold

    return [totals[week] for week in week_starts]
