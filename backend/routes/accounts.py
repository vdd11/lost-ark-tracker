"""Game accounts (rosters) that characters belong to."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Account, Character
from routes.common import get_or_404, next_position
from schemas import AccountCreate, AccountRead, AccountUpdate

router = APIRouter(prefix="/api")


@router.get("/accounts", response_model=list[AccountRead])
def get_accounts(db: Session = Depends(get_db)):
    counts = dict(db.query(Character.account_id, func.count(Character.id)).group_by(Character.account_id).all())
    accounts = db.query(Account).order_by(Account.position, Account.id).all()
    return [
        AccountRead.model_validate(account).model_copy(update={"characters": counts.get(account.id, 0)})
        for account in accounts
    ]


@router.post("/accounts", response_model=AccountRead, status_code=201)
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    account = Account(name=data.name.strip(), position=next_position(db, Account))
    db.add(account)
    db.commit()
    db.refresh(account)
    return AccountRead.model_validate(account)


@router.patch("/accounts/{account_id}", response_model=AccountRead)
def update_account(account_id: int, changes: AccountUpdate, db: Session = Depends(get_db)):
    account = get_or_404(db, Account, account_id)
    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(account, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(account)
    count = db.query(Character).filter_by(account_id=account.id).count()
    return AccountRead.model_validate(account).model_copy(update={"characters": count})


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = get_or_404(db, Account, account_id)
    if db.query(Account).count() == 1:
        raise HTTPException(status_code=409, detail="You need at least one account")
    if db.query(Character).filter_by(account_id=account_id).count():
        raise HTTPException(status_code=409, detail=f"Move or delete {account.name}'s characters first")
    db.delete(account)
    db.commit()
    return Response(status_code=204)
