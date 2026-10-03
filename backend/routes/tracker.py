"""Check-offs for the current reset period, run details and rest bonus."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import get_db
from gems import run_gems
from models import Character, CharacterTask, Completion, RaidDifficulty, Task
from resets import daily_reset_before, period_for, utc_now, weekly_reset_before
from schemas import (
    CompletionUpdate,
    RestState,
    Run,
    RestUpdate,
    TrackerState,
)
from raids import GOLD_RAIDS_PER_WEEK
from rest import RestRules, rest_at_start_of, run_is_rested, start_value_for_shown
from routes.common import get_or_404
from routes.characters import choose_difficulty

router = APIRouter(prefix="/api")


@router.get("/tracker", response_model=TrackerState)
def get_tracker(db: Session = Depends(get_db)):
    now = utc_now()
    daily_reset = daily_reset_before(now)
    weekly_reset = weekly_reset_before(now)

    rows = (
        db.query(Completion, Task.category)
        .join(Task, Task.id == Completion.task_id)
        .filter(Completion.character_id.is_not(None))
        .filter(Completion.period >= weekly_reset.date())
        .all()
    )
    current = [c for c, category in rows if c.period == period_for(category, now)]
    completed = [(c.character_id, c.task_id) for c in current]
    runs = [
        Run(
            character_id=c.character_id,
            task_id=c.task_id,
            difficulty_id=c.difficulty_id,
            count=c.count,
            lucky_rooms=c.lucky_rooms,
            mega_rooms=c.mega_rooms,
            sands=c.sands,
            gems=c.gems,
        )
        for c in current
    ]

    return TrackerState(
        daily_period=daily_reset.date(),
        weekly_period=weekly_reset.date(),
        next_daily_reset=daily_reset + timedelta(days=1),
        next_weekly_reset=weekly_reset + timedelta(days=7),
        completed=completed,
        runs=runs,
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
def complete_task(
    character_id: int,
    task_id: int,
    body: CompletionUpdate | None = None,
    db: Session = Depends(get_db),
):
    """Check a task off, or update this period's run (difficulty, run count).

    Works for raids the character doesn't usually run, so extra clears count.
    """
    character = get_or_404(db, Character, character_id)
    task = get_or_404(db, Task, task_id)
    body = body or CompletionUpdate()

    now = utc_now()
    period = period_for(task.category, now)
    existing = (
        db.query(Completion)
        .filter_by(character_id=character_id, task_id=task_id, period=period)
        .first()
    )

    if body.count == 0:
        if existing is not None:
            db.delete(existing)
            db.commit()
        return Response(status_code=204)

    if task.roster_limited:
        other = (
            db.query(Character.name)
            .join(Completion, Completion.character_id == Character.id)
            .filter(Completion.task_id == task_id, Completion.period == period, Character.id != character_id)
            .first()
        )
        if other is not None:
            raise HTTPException(status_code=409, detail=f"{task.name} was already cleared this week by {other.name}")

    details = body.model_dump(include={"lucky_rooms", "mega_rooms", "sands"}, exclude_none=True)
    if existing is None:
        existing = Completion(
            character_id=character_id,
            task_id=task_id,
            period=period,
            completed_at=now,
            difficulty_id=run_difficulty(db, task, character, body.difficulty_id),
            count=body.count or 1,
            **details,
        )
        db.add(existing)
        db.flush()
        price_completion(db, character, task, existing)
        existing.gems = completion_gems(db, task, existing)
    else:
        changed = bool(details) or body.count is not None
        if body.count is not None:
            existing.count = body.count
        for field, value in details.items():
            setattr(existing, field, value)
        # Only a different difficulty re-prices a clear; history stays as recorded.
        if body.difficulty_id is not None and body.difficulty_id != existing.difficulty_id:
            existing.difficulty_id = run_difficulty(db, task, character, body.difficulty_id)
            price_completion(db, character, task, existing)
            changed = True
        if changed:
            existing.gems = completion_gems(db, task, existing)
    db.commit()

    return Response(status_code=204)


def run_difficulty(db: Session, task: Task, character: Character, requested: int | None) -> int | None:
    """The requested difficulty, else the usual one, else the best for the item level."""
    if requested is None:
        assignment = db.get(CharacterTask, (character.id, task.id))
        if assignment is not None and assignment.difficulty_id is not None:
            return assignment.difficulty_id
    return choose_difficulty(db, task, character, requested)


def completion_gems(db: Session, task: Task, completion: Completion):
    difficulty = db.get(RaidDifficulty, completion.difficulty_id) if completion.difficulty_id else None
    return run_gems(task, difficulty, completion)


def price_completion(db: Session, character: Character, task: Task, completion: Completion):
    """Snapshot a clear's gold and how much of it is bound."""
    completion.gold = completion_gold(db, character, task, completion)
    difficulty = db.get(RaidDifficulty, completion.difficulty_id) if completion.difficulty_id else None
    percent = difficulty.bound_percent if difficulty else 0
    completion.bound_gold = round(completion.gold * percent / 100)


def completion_gold(db: Session, character: Character, task: Task, completion: Completion) -> int:
    """Gold a clear pays right now, snapshotted onto the completion."""
    gold = task.gold
    if completion.difficulty_id is not None:
        difficulty = db.get(RaidDifficulty, completion.difficulty_id)
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
                Completion.period == completion.period,
                Completion.id != completion.id,
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
