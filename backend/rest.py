"""Rest bonus (rested gauge) for daily content like Chaos Dungeons and Guardian Raids.

The game fills a gauge for every day a character skips the content, and a run
spends part of it for bonus rewards. The tracker can't read the game, so the
gauge is replayed from the check-off history, starting from an anchor: a value
the user entered (or 0) as of the start of some daily period.
"""

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class RestRules:
    max: int
    gain: int  # added at reset for each day the content was skipped
    cost: int  # spent by a run when the gauge has at least this much

    @property
    def enabled(self) -> bool:
        return self.max > 0


def run_is_rested(value: int, rules: RestRules) -> bool:
    return rules.cost > 0 and value >= rules.cost


def after_day(value: int, completed: bool, rules: RestRules) -> int:
    """The gauge at the next reset, given its value at the start of a day."""
    if completed:
        return value - rules.cost if run_is_rested(value, rules) else value
    return min(rules.max, value + rules.gain)


def rest_at_start_of(day: date, anchor_value: int, anchor_day: date, completed_days: set[date], rules: RestRules) -> int:
    value = anchor_value
    current = anchor_day
    while current < day:
        value = after_day(value, current in completed_days, rules)
        current += timedelta(days=1)
    return value


def start_value_for_shown(shown: int, completed_today: bool, rules: RestRules) -> int:
    """Turn the gauge the game shows right now into a start-of-day anchor.

    After today's run the game shows the gauge with the cost already spent.
    If the run wasn't actually rested, adding the cost back still replays to
    the same value at the next reset, so the assumption is harmless.
    """
    shown = max(0, min(rules.max, shown))
    if completed_today and shown + rules.cost <= rules.max:
        return shown + rules.cost
    return shown
