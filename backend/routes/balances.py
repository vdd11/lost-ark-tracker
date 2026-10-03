"""Gold check-ins: balances on hand and the untracked spending they reveal."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from accounts import first_account_id
from balances import Balances, evaluate_checks, expected_now
from database import get_db
from models import Account, BalanceCheck, Character
from resets import utc_now
from schemas import BalanceCheckCreate, BalanceCheckRead, BalancesOut, ExpectedBalances
from routes.common import get_or_404, to_naive_utc

router = APIRouter(prefix="/api")


def balances_out(balances: Balances) -> BalancesOut:
    return BalancesOut(
        tradeable=balances.tradeable,
        roster_bound=balances.roster_bound,
        character_bound=balances.character_bound,
        total=balances.total,
    )


def read_checks(db: Session, account_id: int | None = None) -> list[BalanceCheckRead]:
    """Check-ins, newest first."""
    return [
        BalanceCheckRead(
            id=result.check.id,
            account_id=result.check.account_id,
            checked_at=result.check.checked_at,
            actual=balances_out(Balances.of(result.check)),
            note=result.check.note,
            expected=balances_out(result.expected) if result.expected else None,
            untracked=balances_out(result.untracked) if result.untracked else None,
        )
        for result in reversed(evaluate_checks(db, account_id))
    ]


@router.get("/balances", response_model=list[BalanceCheckRead])
def get_balance_checks(account_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    return read_checks(db, account_id)


@router.get("/balances/expected", response_model=ExpectedBalances | None)
def get_expected_balances(account_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    """What should be on hand now, for pre-filling the next check-in. Without
    account_id, every account that has checked in, added together."""
    found = expected_now(db, utc_now(), account_id)
    if found is None:
        return None
    last_check_in, expected = found
    return ExpectedBalances(last_check_in=last_check_in, expected=balances_out(expected))


@router.post("/balances", response_model=BalanceCheckRead, status_code=201)
def create_balance_check(data: BalanceCheckCreate, db: Session = Depends(get_db)):
    account_id = get_or_404(db, Account, data.account_id).id if data.account_id else first_account_id(db)
    known = {cid for (cid,) in db.query(Character.id).filter_by(account_id=account_id)}
    if not set(data.character_bound) <= known:
        raise HTTPException(status_code=400, detail="Unknown character in character-bound gold")
    if any(amount < 0 for amount in data.character_bound.values()):
        raise HTTPException(status_code=400, detail="Character-bound gold can't be negative")

    check = BalanceCheck(
        checked_at=to_naive_utc(data.checked_at),
        tradeable=data.tradeable,
        roster_bound=data.roster_bound,
        character_bound={str(cid): amount for cid, amount in data.character_bound.items()} or None,
        note=data.note,
        account_id=account_id,
    )
    db.add(check)
    db.commit()
    return next(r for r in read_checks(db) if r.id == check.id)


@router.delete("/balances/{check_id}", status_code=204)
def delete_balance_check(check_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, BalanceCheck, check_id))
    db.commit()
    return Response(status_code=204)
