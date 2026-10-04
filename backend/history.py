"""Per-character weekly history: raid clears and gold over recent weeks, from
the completions and gold entries already stored (no extra tables)."""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from models import Character, Completion, GoldEntry, Task
from resets import utc_now, week_of, weekly_reset_before


def weekly_history(db: Session, weeks: int) -> tuple[list[date], dict[int, dict[date, dict]]]:
    """The last `weeks` reset weeks (oldest first) and, per character and week:
    raid clears, how many of them paid gold, and gold earned (raid gold after
    bonus boxes, plus gold logged for that character)."""
    current = week_of(utc_now())
    week_starts = [current - timedelta(weeks=i) for i in reversed(range(weeks))]
    first_reset = weekly_reset_before(utc_now()) - timedelta(weeks=weeks - 1)
    empty = lambda: {"raids": 0, "paid_raids": 0, "gold": 0}  # noqa: E731
    history: dict[int, dict[date, dict]] = defaultdict(lambda: defaultdict(empty))

    clears = (
        db.query(Completion, Task.category, Task.gold_for_everyone)
        .join(Task, Task.id == Completion.task_id)
        .filter(Completion.completed_at >= first_reset, Completion.character_id.is_not(None))
    )
    for completion, category, for_everyone in clears:
        week = week_of(completion.completed_at)
        if week not in week_starts:
            continue
        cell = history[completion.character_id][week]
        cell["gold"] += completion.gold - completion.bonus_spent
        if category == "raid":
            cell["raids"] += 1
            # Event raids pay anyone without using one of the 3 gold slots.
            if completion.gold > 0 and not for_everyone:
                cell["paid_raids"] += 1

    entries = db.query(GoldEntry).filter(GoldEntry.earned_at >= first_reset, GoldEntry.character_id.is_not(None))
    for entry in entries:
        week = week_of(entry.earned_at)
        if week in week_starts:
            history[entry.character_id][week]["gold"] += entry.amount

    known = {character_id for (character_id,) in db.query(Character.id)}
    return week_starts, {
        character_id: {week: dict(weeks_data[week]) for week in week_starts}
        for character_id, weeks_data in history.items()
        if character_id in known
    }
