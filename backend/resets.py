"""Lost Ark reset timing.

NA and EU servers reset dailies at 10:00 UTC, and weeklies at that same time
on Wednesday. All datetimes here are naive UTC, matching what SQLite stores.
"""

from datetime import date, datetime, timedelta, timezone

RESET_HOUR_UTC = 10
WEEKLY_RESET_WEEKDAY = 2  # Monday is 0, so 2 is Wednesday.


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def daily_reset_before(moment: datetime) -> datetime:
    reset = moment.replace(hour=RESET_HOUR_UTC, minute=0, second=0, microsecond=0)
    if moment < reset:
        reset -= timedelta(days=1)
    return reset


def weekly_reset_before(moment: datetime) -> datetime:
    reset = daily_reset_before(moment)
    days_since_reset_day = (reset.weekday() - WEEKLY_RESET_WEEKDAY) % 7
    return reset - timedelta(days=days_since_reset_day)


def period_for(category: str, moment: datetime) -> date:
    """The reset period a task of this category falls into at the given moment."""
    if category == "daily":
        return daily_reset_before(moment).date()
    return weekly_reset_before(moment).date()


def week_of(moment: datetime) -> date:
    return weekly_reset_before(moment).date()
