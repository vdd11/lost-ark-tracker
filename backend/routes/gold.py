"""Logged gold and the weekly gold summary."""

from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from balances import evaluate_checks
from database import get_db
from models import Character, Completion, GoldEntry
from resets import utc_now, week_of, weekly_reset_before
from schemas import (
    CharacterBoundGold,
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


def spend_bonus_chests(bucket: WeeklyGold, by_character: dict[int | None, list[int]]):
    """Pay for bonus chests the way the game does: each buyer's own
    character-bound gold first, then the roster's roster-bound gold, then
    tradeable gold. Works within the week's earnings."""
    overflow = 0
    for character_id, (earned, spent) in by_character.items():
        from_character = min(earned, spent)
        overflow += spent - from_character
        if character_id is not None and earned:
            bucket.character_bound[character_id] = CharacterBoundGold(
                earned=earned, spent=from_character, left=earned - from_character
            )

    roster_bound = bucket.bound_gold - bucket.character_bound_gold
    from_roster = min(roster_bound, overflow)
    tradeable = bucket.total - bucket.bound_gold

    bucket.roster_bound_left = roster_bound - from_roster
    bucket.tradeable_left = tradeable - (overflow - from_roster)
    bucket.character_bound_left = sum(c.left for c in bucket.character_bound.values())


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

    spending: dict = {}  # week -> character_id -> [character-bound earned, bonus spent]
    for completion in completions:
        week = week_of(completion.completed_at)
        if week in totals:
            entry = spending.setdefault(week, {}).setdefault(completion.character_id, [0, 0])
            entry[0] += completion.character_bound_gold
            entry[1] += completion.bonus_spent

    for result in evaluate_checks(db):
        bucket = totals.get(week_of(result.check.checked_at))
        if bucket is not None and result.untracked_total is not None:
            bucket.untracked_spent = (bucket.untracked_spent or 0) + result.untracked_total

    for week, bucket in totals.items():
        bucket.total = bucket.raid_gold + bucket.other_gold
        bucket.net = bucket.total - bucket.bonus_spent
        spend_bonus_chests(bucket, spending.get(week, {}))

    return [totals[week] for week in week_starts]
