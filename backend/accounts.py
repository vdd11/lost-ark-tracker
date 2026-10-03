"""Game accounts. Each account is its own roster: its own 6 gold earners and
its own once-per-roster event clears."""

from sqlalchemy.orm import Session

from models import Account, Character


def ensure_accounts(db: Session) -> Account:
    """Make sure there's at least one account and every character is on a real
    one (older databases and backups predate accounts). Returns the first."""
    accounts = db.query(Account).order_by(Account.position, Account.id).all()
    if not accounts:
        accounts = [Account(name="Main", position=0)]
        db.add(accounts[0])
        db.flush()
    known = {account.id for account in accounts}
    first = accounts[0]
    db.query(Character).filter(Character.account_id.not_in(known)).update(
        {"account_id": first.id}, synchronize_session=False
    )
    db.commit()
    return first


def first_account_id(db: Session) -> int:
    account = db.query(Account).order_by(Account.position, Account.id).first()
    return account.id if account else ensure_accounts(db).id
