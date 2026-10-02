from datetime import date, datetime

from resets import daily_reset_before, period_for, weekly_reset_before


def test_daily_reset_rolls_back_before_10_utc():
    assert daily_reset_before(datetime(2026, 10, 2, 9, 59)) == datetime(2026, 10, 1, 10)
    assert daily_reset_before(datetime(2026, 10, 2, 10, 0)) == datetime(2026, 10, 2, 10)


def test_weekly_reset_is_wednesday_10_utc():
    # 2026-09-30 is a Wednesday.
    assert weekly_reset_before(datetime(2026, 10, 2, 12)) == datetime(2026, 9, 30, 10)
    assert weekly_reset_before(datetime(2026, 9, 30, 10)) == datetime(2026, 9, 30, 10)
    assert weekly_reset_before(datetime(2026, 9, 30, 9, 59)) == datetime(2026, 9, 23, 10)


def test_period_for_category():
    moment = datetime(2026, 10, 2, 12)
    assert period_for("daily", moment) == date(2026, 10, 2)
    assert period_for("weekly", moment) == date(2026, 9, 30)
    assert period_for("raid", moment) == date(2026, 9, 30)
