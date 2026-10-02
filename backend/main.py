import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Date, DateTime, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import Base, SessionLocal, add_missing_columns, engine, get_db
from models import Character, CharacterTask, Completion, GoldEntry, RaidDifficulty, Task
from resets import daily_reset_before, period_for, utc_now, week_of, weekly_reset_before
from schemas import (
    AssignTask,
    CharacterCreate,
    CharacterRead,
    CharacterUpdate,
    DifficultyCreate,
    DifficultyRead,
    DifficultyUpdate,
    GoldEntryCreate,
    GoldEntryRead,
    RestState,
    RestUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    TrackerState,
    WeeklyGold,
)
from raids import GOLD_RAIDS_PER_WEEK, best_difficulty, sync_raid_catalog
from rest import RestRules, rest_at_start_of, run_is_rested, start_value_for_shown
from seed import apply_default_rest_rules, seed_default_tasks
from version import APP_NAME, APP_VERSION


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create any new tables, upgrade existing ones, and add the default tasks.
    Base.metadata.create_all(bind=engine)
    added_columns = add_missing_columns()
    with SessionLocal() as db:
        seed_default_tasks(db)
        # Databases from before rest tracking get the default rules once.
        if ("tasks", "rest_max") in added_columns:
            apply_default_rest_rules(db)
        sync_raid_catalog(db)
    yield


app = FastAPI(title=APP_NAME, version=APP_VERSION, lifespan=lifespan)

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


router = APIRouter(prefix="/api")


@router.get("/")
def root():
    return {"app": APP_NAME, "version": APP_VERSION}


# ---------- Characters ----------

def to_character_read(character: Character, assignments: list[CharacterTask]) -> CharacterRead:
    return CharacterRead.model_validate(character).model_copy(update={
        "task_ids": [a.task_id for a in assignments],
        "difficulty_ids": {a.task_id: a.difficulty_id for a in assignments if a.difficulty_id is not None},
    })


def read_character(db: Session, character: Character) -> CharacterRead:
    return to_character_read(character, db.query(CharacterTask).filter_by(character_id=character.id).all())


@router.get("/characters", response_model=list[CharacterRead])
def get_characters(db: Session = Depends(get_db)):
    characters = db.query(Character).order_by(Character.position, Character.id).all()

    assignments_by_character: dict[int, list[CharacterTask]] = {}
    for assignment in db.query(CharacterTask).all():
        assignments_by_character.setdefault(assignment.character_id, []).append(assignment)

    return [to_character_read(c, assignments_by_character.get(c.id, [])) for c in characters]


def choose_difficulty(db: Session, task: Task, character: Character, difficulty_id: int | None) -> int | None:
    """Validate a requested difficulty, or pick the best one for the character."""
    difficulties = db.query(RaidDifficulty).filter_by(task_id=task.id).all()
    if difficulty_id is not None:
        if difficulty_id not in {d.id for d in difficulties}:
            raise HTTPException(status_code=400, detail=f"That difficulty isn't part of {task.name}")
        return difficulty_id
    chosen = best_difficulty(difficulties, character.item_level)
    return chosen.id if chosen else None


@router.post("/characters", response_model=CharacterRead, status_code=201)
def create_character(character_data: CharacterCreate, db: Session = Depends(get_db)):
    character = Character(
        **character_data.model_dump(exclude={"raids"}),
        position=next_position(db, Character),
    )
    if not character.reserved_for:
        character.reserved_for = None

    db.add(character)
    db.flush()

    # New characters start with every daily and weekly; raids are opted into
    # per character since they depend on item level.
    for task in db.query(Task).filter(Task.category.in_(["daily", "weekly"]), Task.archived.is_(False)):
        db.add(CharacterTask(character_id=character.id, task_id=task.id))

    for choice in {c.task_id: c for c in character_data.raids}.values():
        task = get_or_404(db, Task, choice.task_id)
        if task.category != "raid":
            raise HTTPException(status_code=400, detail=f"{task.name} isn't a raid")
        db.add(CharacterTask(
            character_id=character.id,
            task_id=task.id,
            difficulty_id=choose_difficulty(db, task, character, choice.difficulty_id),
        ))

    db.commit()
    db.refresh(character)

    return read_character(db, character)


@router.patch("/characters/{character_id}", response_model=CharacterRead)
def update_character(character_id: int, changes: CharacterUpdate, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)

    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    if not character.reserved_for:
        character.reserved_for = None

    db.commit()
    db.refresh(character)

    return read_character(db, character)


@router.delete("/characters/{character_id}", status_code=204)
def delete_character(character_id: int, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)

    db.query(CharacterTask).filter(CharacterTask.character_id == character_id).delete()
    # Keep gold history, just detach it from the deleted character.
    db.query(Completion).filter(Completion.character_id == character_id).update({"character_id": None})
    db.query(GoldEntry).filter(GoldEntry.character_id == character_id).update({"character_id": None})
    db.delete(character)
    db.commit()

    return Response(status_code=204)


@router.put("/characters/{character_id}/tasks/{task_id}", status_code=204)
def assign_task(character_id: int, task_id: int, body: AssignTask | None = None, db: Session = Depends(get_db)):
    """Assign a task, or for a raid, change which difficulty the character runs."""
    character = get_or_404(db, Character, character_id)
    task = get_or_404(db, Task, task_id)
    difficulty_id = choose_difficulty(db, task, character, body.difficulty_id if body else None)

    assignment = db.get(CharacterTask, (character_id, task_id))
    if assignment is None:
        db.add(CharacterTask(character_id=character_id, task_id=task_id, difficulty_id=difficulty_id))
    elif body is not None and body.difficulty_id is not None:
        assignment.difficulty_id = difficulty_id
    db.commit()

    return Response(status_code=204)


@router.delete("/characters/{character_id}/tasks/{task_id}", status_code=204)
def unassign_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    assignment = db.get(CharacterTask, (character_id, task_id))
    if assignment is not None:
        db.delete(assignment)
        db.commit()

    return Response(status_code=204)


# ---------- Tasks ----------

def read_task(db: Session, task: Task) -> TaskRead:
    difficulties = (
        db.query(RaidDifficulty)
        .filter_by(task_id=task.id)
        .order_by(RaidDifficulty.position, RaidDifficulty.id)
    )
    return TaskRead.model_validate(task).model_copy(
        update={"difficulties": [DifficultyRead.model_validate(d) for d in difficulties]}
    )


@router.get("/tasks", response_model=list[TaskRead])
def get_tasks(include_archived: bool = False, db: Session = Depends(get_db)):
    query = db.query(Task)
    if not include_archived:
        query = query.filter(Task.archived.is_(False))
    tasks = query.order_by(Task.position, Task.id).all()

    difficulties_by_task: dict[int, list[DifficultyRead]] = {}
    for d in db.query(RaidDifficulty).order_by(RaidDifficulty.position, RaidDifficulty.id):
        difficulties_by_task.setdefault(d.task_id, []).append(DifficultyRead.model_validate(d))

    return [
        TaskRead.model_validate(t).model_copy(update={"difficulties": difficulties_by_task.get(t.id, [])})
        for t in tasks
    ]


@router.post("/tasks", response_model=TaskRead, status_code=201)
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
    return read_task(db, task)


@router.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, changes: TaskUpdate, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)

    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return read_task(db, task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)

    db.query(CharacterTask).filter(CharacterTask.task_id == task_id).delete()
    if task.catalog_key:
        # Catalog raids come back on every sync, so hide them instead.
        task.archived = True
    else:
        db.query(Completion).filter(Completion.task_id == task_id).update({"task_id": None})
        db.query(RaidDifficulty).filter(RaidDifficulty.task_id == task_id).delete()
        db.delete(task)
    db.commit()

    return Response(status_code=204)


# ---------- Tracker (check-offs) ----------

@router.get("/tracker", response_model=TrackerState)
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
        rest=current_rest(db, daily_reset.date()),
    )


def rules_for(task: Task) -> RestRules:
    return RestRules(max=task.rest_max, gain=task.rest_gain, cost=task.rest_cost)


def current_rest(db: Session, today) -> list[RestState]:
    tasks = {task.id: task for task in db.query(Task).filter(Task.rest_max > 0)}
    if not tasks:
        return []

    assignments = db.query(CharacterTask).filter(CharacterTask.task_id.in_(tasks)).all()
    completed_days: dict[tuple[int, int], set] = {}
    for character_id, task_id, period in (
        db.query(Completion.character_id, Completion.task_id, Completion.period)
        .filter(Completion.task_id.in_(tasks), Completion.character_id.is_not(None))
    ):
        completed_days.setdefault((character_id, task_id), set()).add(period)

    states = []
    for assignment in assignments:
        rules = rules_for(tasks[assignment.task_id])
        days = completed_days.get((assignment.character_id, assignment.task_id), set())

        if assignment.rest_period is None:
            # Nothing entered yet: start tracking from an empty gauge today.
            start = 0
        else:
            start = rest_at_start_of(today, assignment.rest_value, assignment.rest_period, days, rules)
        start = min(start, rules.max)  # in case the max was lowered
        # Move the anchor up to today. Past days can't be unchecked anymore,
        # so this loses nothing and keeps the replay short.
        assignment.rest_value, assignment.rest_period = start, today

        done_today = today in days
        rested = run_is_rested(start, rules)
        states.append(RestState(
            character_id=assignment.character_id,
            task_id=assignment.task_id,
            value=start - rules.cost if done_today and rested else start,
            rested_run_available=rested and not done_today,
        ))

    db.commit()
    return states


@router.put("/characters/{character_id}/tasks/{task_id}/rest", status_code=204)
def set_rest(character_id: int, task_id: int, update: RestUpdate, db: Session = Depends(get_db)):
    """Sync the gauge with the game: `value` is what the game shows right now."""
    assignment = db.get(CharacterTask, (character_id, task_id))
    if assignment is None:
        raise HTTPException(status_code=404, detail="Character doesn't do this task")
    task = get_or_404(db, Task, task_id)
    rules = rules_for(task)
    if not rules.enabled:
        raise HTTPException(status_code=400, detail="This task has no rest bonus")

    today = daily_reset_before(utc_now()).date()
    done_today = (
        db.query(Completion)
        .filter_by(character_id=character_id, task_id=task_id, period=today)
        .first()
        is not None
    )
    assignment.rest_value = start_value_for_shown(update.value, done_today, rules)
    assignment.rest_period = today
    db.commit()

    return Response(status_code=204)


@router.put("/characters/{character_id}/tasks/{task_id}/completion", status_code=204)
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
            gold=completion_gold(db, character, task, period),
        ))
        db.commit()

    return Response(status_code=204)


def completion_gold(db: Session, character: Character, task: Task, period) -> int:
    """Gold a clear pays right now, snapshotted onto the completion."""
    gold = task.gold
    assignment = db.get(CharacterTask, (character.id, task.id))
    if assignment is not None and assignment.difficulty_id is not None:
        difficulty = db.get(RaidDifficulty, assignment.difficulty_id)
        gold = (difficulty.gold or 0) if difficulty else 0

    if task.gold_for_everyone:
        return gold
    if not character.is_gold_earner:
        return 0

    if task.category == "raid":
        paid_raids_this_week = (
            db.query(Completion)
            .join(Task, Task.id == Completion.task_id)
            .filter(
                Completion.character_id == character.id,
                Completion.period == period,
                Completion.gold > 0,
                Task.category == "raid",
                Task.gold_for_everyone.is_(False),
            )
            .count()
        )
        if paid_raids_this_week >= GOLD_RAIDS_PER_WEEK:
            return 0
    return gold


@router.delete("/characters/{character_id}/tasks/{task_id}/completion", status_code=204)
def uncomplete_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)
    period = period_for(task.category, utc_now())

    db.query(Completion).filter_by(
        character_id=character_id, task_id=task_id, period=period
    ).delete()
    db.commit()

    return Response(status_code=204)


# ---------- Gold ----------

@router.get("/gold-entries", response_model=list[GoldEntryRead])
def get_gold_entries(limit: int = Query(default=100, le=1000), db: Session = Depends(get_db)):
    return (
        db.query(GoldEntry)
        .order_by(GoldEntry.earned_at.desc(), GoldEntry.id.desc())
        .limit(limit)
        .all()
    )


@router.post("/gold-entries", response_model=GoldEntryRead, status_code=201)
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


@router.delete("/gold-entries/{entry_id}", status_code=204)
def delete_gold_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = get_or_404(db, GoldEntry, entry_id)
    db.delete(entry)
    db.commit()
    return Response(status_code=204)


@router.get("/gold/weekly", response_model=list[WeeklyGold])
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


# ---------- Raid difficulties ----------

@router.post("/tasks/{task_id}/difficulties", response_model=DifficultyRead, status_code=201)
def create_difficulty(task_id: int, data: DifficultyCreate, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)
    if task.category != "raid":
        raise HTTPException(status_code=400, detail="Only raids have difficulties")
    highest = db.query(func.max(RaidDifficulty.position)).filter_by(task_id=task_id).scalar()
    difficulty = RaidDifficulty(task_id=task_id, position=0 if highest is None else highest + 1, **data.model_dump())
    db.add(difficulty)
    db.commit()
    db.refresh(difficulty)
    return difficulty


@router.patch("/difficulties/{difficulty_id}", response_model=DifficultyRead)
def update_difficulty(difficulty_id: int, changes: DifficultyUpdate, db: Session = Depends(get_db)):
    difficulty = get_or_404(db, RaidDifficulty, difficulty_id)
    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(difficulty, field, value)
    db.commit()
    db.refresh(difficulty)
    return difficulty


@router.post("/difficulties/{difficulty_id}/reset", response_model=DifficultyRead)
def reset_difficulty(difficulty_id: int, db: Session = Depends(get_db)):
    """Go back to the catalog's gold and item level."""
    difficulty = get_or_404(db, RaidDifficulty, difficulty_id)
    difficulty.gold = difficulty.catalog_gold
    if difficulty.catalog_item_level is not None:
        difficulty.min_item_level = difficulty.catalog_item_level
    db.commit()
    db.refresh(difficulty)
    return difficulty


@router.delete("/difficulties/{difficulty_id}", status_code=204)
def delete_difficulty(difficulty_id: int, db: Session = Depends(get_db)):
    difficulty = get_or_404(db, RaidDifficulty, difficulty_id)
    if difficulty.catalog_item_level is not None:
        raise HTTPException(status_code=400, detail="Built-in difficulties can't be deleted")
    db.query(CharacterTask).filter_by(difficulty_id=difficulty_id).update({"difficulty_id": None})
    db.delete(difficulty)
    db.commit()
    return Response(status_code=204)


# ---------- Backup ----------

# Restore order: parents before children. Deletes run in reverse.
BACKUP_MODELS = {
    "characters": Character,
    "tasks": Task,
    "raid_difficulties": RaidDifficulty,
    "character_tasks": CharacterTask,
    "completions": Completion,
    "gold_entries": GoldEntry,
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


app.include_router(router)

# In the packaged app, the exported Next.js frontend is served from the same
# server. Mounted last so the /api routes above take priority.
FRONTEND_DIR = os.environ.get("FRONTEND_DIR")
if FRONTEND_DIR and Path(FRONTEND_DIR).is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
