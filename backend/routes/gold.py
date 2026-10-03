"""Logged gold and the weekly gold summary."""

from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from database import get_db
from models import Character, Completion, GoldEntry
from resets import utc_now, week_of, weekly_reset_before
from schemas import (
    GoldEntryCreate,
    GoldEntryRead,
    WeeklyGold,
)
from routes.common import get_or_404, to_naive_utc

router = APIRouter(prefix="/api")


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
    earned_at = to_naive_utc(values.pop("earned_at"))
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
        week: WeeklyGold(week=week, raid_gold=0, other_gold=0, total=0, by_source={}, by_character={})
        for week in week_starts
    }
    names = dict(db.query(Character.id, Character.name).all())

    def credit(bucket: WeeklyGold, character_id: int | None, amount: int):
        who = names.get(character_id, "Unassigned")
        bucket.by_character[who] = bucket.by_character.get(who, 0) + amount

    completions = (
        db.query(Completion)
        .filter(Completion.completed_at >= first_reset)
        .filter((Completion.gold > 0) | (Completion.bonus_spent > 0))
        .all()
    )
    for completion in completions:
        bucket = totals.get(week_of(completion.completed_at))
        if bucket is not None:
            bucket.raid_gold += completion.gold
            bucket.bound_gold += completion.bound_gold
            bucket.character_bound_gold += completion.character_bound_gold
            bucket.bonus_spent += completion.bonus_spent
            credit(bucket, completion.character_id, completion.gold - completion.bonus_spent)

    entries = db.query(GoldEntry).filter(GoldEntry.earned_at >= first_reset).all()
    for entry in entries:
        bucket = totals.get(week_of(entry.earned_at))
        if bucket is not None:
            bucket.other_gold += entry.amount
            bucket.by_source[entry.source] = bucket.by_source.get(entry.source, 0) + entry.amount
            credit(bucket, entry.character_id, entry.amount)

    for bucket in totals.values():
        bucket.total = bucket.raid_gold + bucket.other_gold
        bucket.net = bucket.total - bucket.bonus_spent

    return [totals[week] for week in week_starts]
