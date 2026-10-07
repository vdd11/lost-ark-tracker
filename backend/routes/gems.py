"""Logged gems and the weekly gem summary."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from accounts import account_owner
from database import get_db
from gems import lv1_equivalent
from models import Character, Completion, GemEntry, Task
from resets import utc_now, week_of, weekly_reset_before
from schemas import (
    GemEntryCreate,
    GemEntryRead,
    GemTotal,
    WeeklyGems,
)
from routes.common import get_or_404, to_naive_utc

router = APIRouter(prefix="/api")


@router.get("/gem-entries", response_model=list[GemEntryRead])
def get_gem_entries(
    limit: int = Query(default=100, le=1000),
    account_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    entries = db.query(GemEntry).order_by(GemEntry.earned_at.desc(), GemEntry.id.desc())
    if account_id is None:
        return entries.limit(limit).all()
    owner = account_owner(db)
    return [e for e in entries if owner(e.character_id) == account_id][:limit]


@router.post("/gem-entries", response_model=GemEntryRead, status_code=201)
def create_gem_entry(data: GemEntryCreate, db: Session = Depends(get_db)):
    if data.character_id is not None:
        get_or_404(db, Character, data.character_id)
    gems = {str(level): count for level, count in sorted(data.gems.items()) if count > 0}
    if not gems:
        raise HTTPException(status_code=400, detail="Enter at least one gem")

    entry = GemEntry(
        source=data.source,
        character_id=data.character_id,
        gems=gems,
        note=data.note,
        earned_at=to_naive_utc(data.earned_at),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/gem-entries/{entry_id}", status_code=204)
def delete_gem_entry(entry_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, GemEntry, entry_id))
    db.commit()
    return Response(status_code=204)


@router.get("/gems/weekly", response_model=list[WeeklyGems])
def get_weekly_gems(
    weeks: int = Query(default=12, ge=1, le=520),
    account_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """Gems per reset week, oldest first, in level-1 equivalents; one account's with account_id."""
    current_week = week_of(utc_now())
    week_starts = [current_week - timedelta(weeks=i) for i in reversed(range(weeks))]
    first_reset = weekly_reset_before(utc_now()) - timedelta(weeks=weeks - 1)
    totals = {
        week: WeeklyGems(week=week, total=0, by_source={}, by_level={}, by_character={})
        for week in week_starts
    }
    names = dict(db.query(Character.id, Character.name).all())
    owner = account_owner(db)

    def add(week, source: str, character_id: int | None, gems: dict):
        bucket = totals.get(week)
        if bucket is None or (account_id is not None and owner(character_id) != account_id):
            return
        who = names.get(character_id, "Unassigned")
        for level, count in gems.items():
            value = lv1_equivalent(int(level), count)
            bucket.total += value
            bucket.by_source[source] = bucket.by_source.get(source, 0) + value
            bucket.by_character[who] = bucket.by_character.get(who, 0) + value
            bucket.by_level[int(level)] = bucket.by_level.get(int(level), 0) + count

    for when, source, character_id, gems in gem_rows(db, first_reset):
        add(week_of(when), source, character_id, gems)

    for bucket in totals.values():
        bucket.total = round(bucket.total, 1)
        bucket.by_source = {k: round(v, 1) for k, v in bucket.by_source.items()}
        bucket.by_character = {k: round(v, 1) for k, v in bucket.by_character.items()}
        bucket.by_level = {k: round(v, 2) for k, v in bucket.by_level.items()}
    return [totals[week] for week in week_starts]


def gem_rows(db: Session, since=None):
    """Every gem gain, logged or from a tracked run: (when, source, character_id, {level: count})."""
    entries = db.query(GemEntry)
    if since is not None:
        entries = entries.filter(GemEntry.earned_at >= since)
    for entry in entries:
        yield entry.earned_at, entry.source, entry.character_id, entry.gems

    tracked = (
        db.query(Completion, Task.name)
        .outerjoin(Task, Task.id == Completion.task_id)
        .filter(Completion.gems.is_not(None))
    )
    if since is not None:
        tracked = tracked.filter(Completion.completed_at >= since)
    for completion, task_name in tracked:
        if completion.gems:  # older rows may hold a JSON null
            yield completion.completed_at, task_name or "Other", completion.character_id, completion.gems


@router.get("/gems/total", response_model=GemTotal)
def get_gem_total(account_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    """Every gem tracked so far, in level-1 equivalents (the Gem progress widget's goals), without
    sending the whole weekly history."""
    owner = account_owner(db)
    total = sum(
        lv1_equivalent(int(level), count)
        for _, _, character_id, gems in gem_rows(db)
        if account_id is None or owner(character_id) == account_id
        for level, count in gems.items()
    )
    return GemTotal(total=round(total, 1))
