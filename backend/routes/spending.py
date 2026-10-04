"""Logged spending: gold that went on honing, gems, the market or anything
else. Check-ins subtract it (balances.py), so what's left as "untracked" is
only what the user didn't log."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from accounts import account_owner
from database import get_db
from models import Account, Character, SpendingEntry
from routes.common import get_or_404, to_naive_utc
from schemas import SpendingCreate, SpendingRead

router = APIRouter(prefix="/api")


@router.get("/spending", response_model=list[SpendingRead])
def get_spending(
    limit: int = Query(default=100, le=1000),
    account_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    entries = db.query(SpendingEntry).order_by(SpendingEntry.spent_at.desc(), SpendingEntry.id.desc())
    if account_id is None:
        return entries.limit(limit).all()
    owner = account_owner(db)
    return [e for e in entries if owner(e.character_id, e.account_id) == account_id][:limit]


@router.post("/spending", response_model=SpendingRead, status_code=201)
def create_spending(data: SpendingCreate, db: Session = Depends(get_db)):
    values = data.model_dump()
    if data.category == "market" and data.paid_from == "bound_first":
        raise HTTPException(status_code=400, detail="Market purchases can only use tradeable gold.")
    values["paid_from"] = data.paid_from or ("tradeable" if data.category == "market" else "bound_first")
    if data.character_id is not None:
        values["account_id"] = get_or_404(db, Character, data.character_id).account_id
    elif data.account_id is not None:
        get_or_404(db, Account, data.account_id)
    spent_at = to_naive_utc(values.pop("spent_at"))
    entry = SpendingEntry(**values, spent_at=spent_at)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/spending/{entry_id}", status_code=204)
def delete_spending(entry_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, SpendingEntry, entry_id))
    db.commit()
    return Response(status_code=204)
