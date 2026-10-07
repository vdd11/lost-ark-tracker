"""Gold balances between check-ins.

A check-in records the gold on hand. The next one's *expected* balance is
the previous check-in plus tracked earnings since, minus bonus chests bought
since, which spend the buyer's character-bound gold first, then roster-bound,
then tradeable (as in game), and logged spending. Whatever is missing from the actual balance was
spent on things the app doesn't track.

Gold is per account, so each account's check-ins form their own chain and
only that account's gold flows count toward them.

Character-bound gold is checked in per character on the tracker
(CharacterBoundCheck) and kept up to date from there; weekly check-ins hold
only tradeable and roster-bound gold. When a check-in has no figure for a
character, the tracked one stands in, so chests paid from character-bound
gold aren't mistaken for roster or tradeable spending. Older check-ins that
include character-bound gold work as before.
"""

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from accounts import account_owner
from models import Account, BalanceCheck, Character, CharacterBoundCheck, Completion, GoldEntry, SpendingEntry


@dataclass
class Balances:
    tradeable: int = 0
    roster_bound: int = 0
    character_bound: dict[int, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return self.tradeable + self.roster_bound + sum(self.character_bound.values())

    @classmethod
    def of(cls, check: BalanceCheck) -> "Balances":
        return cls(
            tradeable=check.tradeable,
            roster_bound=check.roster_bound,
            character_bound={int(k): v for k, v in (check.character_bound or {}).items()},
        )


def project(db: Session, start: Balances, since: datetime, until: datetime, account_id: int | None = None) -> Balances:
    """Roll balances forward over (since, until] using tracked gold flows,
    only one account's when account_id is given."""
    result = Balances(start.tradeable, start.roster_bound, dict(start.character_bound))
    owner = account_owner(db)
    mine = lambda character_id, entry_account=None: (  # noqa: E731
        account_id is None or owner(character_id, entry_account) == account_id
    )

    for entry in db.query(GoldEntry).filter(GoldEntry.earned_at > since, GoldEntry.earned_at <= until):
        if not mine(entry.character_id, entry.account_id):
            continue
        if entry.character_bound and entry.character_id is not None:
            result.character_bound[entry.character_id] = result.character_bound.get(entry.character_id, 0) + entry.amount
        else:
            result.tradeable += entry.amount

    in_window = lambda moment: since < moment <= until  # noqa: E731
    candidates = (
        db.query(Completion)
        .filter((Completion.gold > 0) | (Completion.bonus_spent > 0))
        .filter((Completion.completed_at <= until) | (Completion.bonus_bought_at <= until))
        .order_by(Completion.completed_at, Completion.id)
        .all()
    )
    candidates = [c for c in candidates if mine(c.character_id)]
    clears = [c for c in candidates if in_window(c.completed_at)]
    # Chests count when bought, which can be after the clear.
    purchases = [c for c in candidates if c.bonus_spent and in_window(c.bonus_bought_at or c.completed_at)]

    # Earnings first, then spending, so a chest can use gold from the same window.
    for clear in clears:
        result.tradeable += clear.gold - clear.bound_gold
        result.roster_bound += clear.bound_gold - clear.character_bound_gold
        if clear.character_bound_gold and clear.character_id is not None:
            result.character_bound[clear.character_id] = (
                result.character_bound.get(clear.character_id, 0) + clear.character_bound_gold
            )
    for purchase in purchases:
        spend(result, purchase.character_id, purchase.bonus_spent)
    logged = db.query(SpendingEntry).filter(SpendingEntry.spent_at > since, SpendingEntry.spent_at <= until)
    for entry in logged.order_by(SpendingEntry.spent_at, SpendingEntry.id):
        if not mine(entry.character_id, entry.account_id):
            continue
        if entry.paid_from == "tradeable":
            result.tradeable -= entry.amount
        else:
            spend(result, entry.character_id, entry.amount)
    return result


def spend(balances: Balances, character_id: int | None, amount: int):
    """Character-bound (of the buyer) first, then roster-bound, then tradeable."""
    if amount <= 0:
        return
    own = balances.character_bound.get(character_id, 0) if character_id is not None else 0
    from_character = min(max(own, 0), amount)
    if from_character:
        balances.character_bound[character_id] = own - from_character
    rest = amount - from_character
    from_roster = min(max(balances.roster_bound, 0), rest)
    balances.roster_bound -= from_roster
    balances.tradeable -= rest - from_roster


@dataclass
class CheckResult:
    check: BalanceCheck
    expected: Balances | None
    # expected - actual: gold that went somewhere the app doesn't track.
    untracked: Balances | None

    @property
    def untracked_total(self) -> int | None:
        return self.untracked.total if self.untracked else None


def account_ids(db: Session) -> list[int]:
    return [account_id for (account_id,) in db.query(Account.id).order_by(Account.position, Account.id)]


def evaluate_checks(db: Session, account_id: int | None = None) -> list[CheckResult]:
    """Check-ins, oldest first, with what was expected and what's unaccounted
    for. Each account is its own chain; without account_id, all of them."""
    if account_id is None:
        results = [r for a in account_ids(db) for r in evaluate_checks(db, a)]
        return sorted(results, key=lambda r: (r.check.checked_at, r.check.id))

    checks = (
        db.query(BalanceCheck)
        .filter_by(account_id=account_id)
        .order_by(BalanceCheck.checked_at, BalanceCheck.id)
        .all()
    )
    results: list[CheckResult] = []
    previous: BalanceCheck | None = None
    for check in checks:
        if previous is None:
            results.append(CheckResult(check, None, None))
        else:
            expected = project(db, seeded(db, previous), previous.checked_at, check.checked_at, account_id)
            actual = Balances.of(check)
            # Only compare characters counted in both check-ins.
            counted = set(actual.character_bound) & set(Balances.of(previous).character_bound)
            untracked = Balances(
                tradeable=expected.tradeable - actual.tradeable,
                roster_bound=expected.roster_bound - actual.roster_bound,
                character_bound={
                    cid: expected.character_bound.get(cid, 0) - actual.character_bound[cid] for cid in counted
                },
            )
            results.append(CheckResult(check, expected, untracked))
        previous = check
    return results


def expected_now(db: Session, now: datetime, account_id: int | None = None) -> tuple[datetime, Balances] | None:
    """What should be on hand now, from the latest check-in. Without
    account_id, the accounts that have checked in added together, dated by
    the oldest of their latest check-ins (the one most in need of a new one)."""
    if account_id is None:
        found = [f for a in account_ids(db) if (f := expected_now(db, now, a))]
        if not found:
            return None
        total = Balances()
        for _, balances in found:
            total.tradeable += balances.tradeable
            total.roster_bound += balances.roster_bound
            total.character_bound.update(balances.character_bound)
        return min(when for when, _ in found), total

    latest = (
        db.query(BalanceCheck)
        .filter_by(account_id=account_id)
        .order_by(BalanceCheck.checked_at.desc(), BalanceCheck.id.desc())
        .first()
    )
    if latest is None:
        return None
    return latest.checked_at, project(db, seeded(db, latest), latest.checked_at, now, account_id)


def seeded(db: Session, check: BalanceCheck) -> Balances:
    """A check-in's balances, with each of its account's characters' tracked
    character-bound gold filled in where the check-in has none."""
    start = Balances.of(check)
    for (character_id,) in db.query(Character.id).filter_by(account_id=check.account_id):
        if character_id not in start.character_bound:
            amount = character_bound_at(db, character_id, check.checked_at)
            if amount is not None:
                start.character_bound[character_id] = amount
    return start


def character_bound_at(db: Session, character_id: int, at: datetime) -> int | None:
    """A character's character-bound gold at a moment: their latest figure
    (a tracker check-in, or an older weekly check-in that listed them) rolled
    forward with what they earned and spent since. None if never entered."""
    character = db.get(Character, character_id)
    if character is None:
        return None
    own = (
        db.query(CharacterBoundCheck)
        .filter(CharacterBoundCheck.character_id == character_id, CharacterBoundCheck.checked_at <= at)
        .order_by(CharacterBoundCheck.checked_at.desc(), CharacterBoundCheck.id.desc())
        .first()
    )
    start: tuple[datetime, int] | None = (own.checked_at, own.amount) if own else None
    key = str(character_id)
    for check in (
        db.query(BalanceCheck)
        .filter(BalanceCheck.account_id == character.account_id, BalanceCheck.checked_at <= at)
        .order_by(BalanceCheck.checked_at.desc(), BalanceCheck.id.desc())
    ):
        if check.character_bound and key in check.character_bound:
            if start is None or check.checked_at > start[0]:
                start = (check.checked_at, check.character_bound[key])
            break
    if start is None:
        return None
    since, amount = start
    rolled = project(db, Balances(character_bound={character_id: amount}), since, at, character.account_id)
    return rolled.character_bound.get(character_id, 0)
