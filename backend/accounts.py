"""Game accounts. Each account is its own roster: its own 6 gold earners and
its own once-per-roster event clears."""

from collections.abc import Callable

from sqlalchemy.orm import Session

from models import Account, BalanceCheck, Character


def ensure_accounts(db: Session) -> Account:
    """Make sure there's at least one account and every character and gold
    check-in is on a real one (older databases and backups predate accounts).
    Returns the first."""
    accounts = db.query(Account).order_by(Account.position, Account.id).all()
    if not accounts:
        accounts = [Account(name="Main", position=0)]
        db.add(accounts[0])
        db.flush()
    known = {account.id for account in accounts}
    first = accounts[0]
    for model in (Character, BalanceCheck):
        db.query(model).filter(model.account_id.not_in(known)).update(
            {"account_id": first.id}, synchronize_session=False
        )
    db.commit()
    return first


def first_account_id(db: Session) -> int:
    account = db.query(Account).order_by(Account.position, Account.id).first()
    return account.id if account else ensure_accounts(db).id


def account_owner(db: Session) -> Callable[..., int]:
    """Which account gold or gems belong to: the character's, else the one it
    was logged to, else the first account (gold logged to nobody in particular,
    or from a character that has since been deleted)."""
    first = first_account_id(db)
    of_character = dict(db.query(Character.id, Character.account_id).all())

    def owner(character_id: int | None = None, account_id: int | None = None) -> int:
        if character_id is not None and character_id in of_character:
            return of_character[character_id]
        return account_id or first

    return owner
