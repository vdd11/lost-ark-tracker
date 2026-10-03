"""Gold balances between check-ins.

A check-in records the gold on hand. The next one's *expected* balance is
the previous check-in plus tracked earnings since, minus bonus chests bought
since, which spend the buyer's character-bound gold first, then roster-bound,
then tradeable (as in game). Whatever is missing from the actual balance was
spent on things the app doesn't track.
"""

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from models import BalanceCheck, Completion, GoldEntry


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


def project(db: Session, start: Balances, since: datetime, until: datetime) -> Balances:
    """Roll balances forward over (since, until] using tracked gold flows."""
    result = Balances(start.tradeable, start.roster_bound, dict(start.character_bound))

    for entry in db.query(GoldEntry).filter(GoldEntry.earned_at > since, GoldEntry.earned_at <= until):
        result.tradeable += entry.amount

    clears = (
        db.query(Completion)
        .filter(Completion.completed_at > since, Completion.completed_at <= until)
        .filter((Completion.gold > 0) | (Completion.bonus_spent > 0))
        .order_by(Completion.completed_at, Completion.id)
        .all()
    )
    # Earnings first, then spending, so a chest can use gold from the same window.
    for clear in clears:
        result.tradeable += clear.gold - clear.bound_gold
        result.roster_bound += clear.bound_gold - clear.character_bound_gold
        if clear.character_bound_gold and clear.character_id is not None:
            result.character_bound[clear.character_id] = (
                result.character_bound.get(clear.character_id, 0) + clear.character_bound_gold
            )
    for clear in clears:
        spend(result, clear.character_id, clear.bonus_spent)
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


def evaluate_checks(db: Session) -> list[CheckResult]:
    """Every check-in, oldest first, with what was expected and what's unaccounted for."""
    checks = db.query(BalanceCheck).order_by(BalanceCheck.checked_at, BalanceCheck.id).all()
    results: list[CheckResult] = []
    previous: BalanceCheck | None = None
    for check in checks:
        if previous is None:
            results.append(CheckResult(check, None, None))
        else:
            expected = project(db, Balances.of(previous), previous.checked_at, check.checked_at)
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


def expected_now(db: Session, now: datetime) -> tuple[BalanceCheck, Balances] | None:
    latest = db.query(BalanceCheck).order_by(BalanceCheck.checked_at.desc(), BalanceCheck.id.desc()).first()
    if latest is None:
        return None
    return latest, project(db, Balances.of(latest), latest.checked_at, now)
