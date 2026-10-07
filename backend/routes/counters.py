"""Progress counters the user keeps by hand (tracker widget)."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Account, Character, Counter
from resets import period_for, utc_now
from routes.common import get_or_404
from schemas import CounterCreate, CounterRead, CounterUpdate

router = APIRouter(prefix="/api")


def roll_over(counter: Counter):
    """A counter that resets starts again from 0 once its daily / weekly reset has passed."""
    if counter.resets not in ("daily", "weekly"):
        return
    current = period_for(counter.resets, utc_now())
    if counter.period != current:
        counter.value, counter.period = 0, current


@router.get("/counters", response_model=list[CounterRead])
def get_counters(db: Session = Depends(get_db)):
    counters = db.query(Counter).order_by(Counter.position, Counter.id).all()
    for counter in counters:
        roll_over(counter)
    db.commit()
    return counters


@router.post("/counters", response_model=CounterRead, status_code=201)
def create_counter(data: CounterCreate, db: Session = Depends(get_db)):
    values = data.model_dump()
    values["name"] = data.name.strip()
    if data.character_id is not None:
        # A character's counter belongs to their account.
        values["account_id"] = get_or_404(db, Character, data.character_id).account_id
    elif data.account_id is not None:
        get_or_404(db, Account, data.account_id)
    last = db.query(func.max(Counter.position)).scalar()
    counter = Counter(**values, position=(last or 0) + 1)
    if counter.resets != "never":
        counter.period = period_for(counter.resets, utc_now())
    db.add(counter)
    db.commit()
    db.refresh(counter)
    return counter


@router.patch("/counters/{counter_id}", response_model=CounterRead)
def update_counter(counter_id: int, data: CounterUpdate, db: Session = Depends(get_db)):
    counter = get_or_404(db, Counter, counter_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("resets"):
        counter.resets = changes["resets"]
        counter.period = period_for(counter.resets, utc_now()) if counter.resets != "never" else None
    roll_over(counter)
    if changes.get("name"):
        counter.name = changes["name"].strip()
    if "target" in changes:
        counter.target = changes["target"]
    if changes.get("value") is not None:
        counter.value = changes["value"]
    if changes.get("add"):
        counter.value = max(0, counter.value + changes["add"])
    if changes.get("position") is not None:
        counter.position = changes["position"]
    db.commit()
    db.refresh(counter)
    return counter


@router.delete("/counters/{counter_id}", status_code=204)
def delete_counter(counter_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Counter, counter_id))
    db.commit()
    return Response(status_code=204)
