from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    class_name: Mapped[str] = mapped_column(String(50))
    item_level: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    # Only a limited number of characters per roster earn raid gold.
    is_gold_earner: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    # Name of the friend this character is being saved for, if any.
    reserved_for: Mapped[str | None] = mapped_column(String(100), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Task(Base):
    """A column in the tracker: a daily, weekly, or raid."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    # One of "daily", "weekly", "raid". Raids reset weekly like weeklies.
    category: Mapped[str] = mapped_column(String(20))
    gold: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Rest bonus rules for dailies; rest_max 0 means the task has no rest gauge.
    rest_max: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    rest_gain: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    rest_cost: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class CharacterTask(Base):
    """Which tasks a character does. Unassigned cells show as N/A in the tracker."""

    __tablename__ = "character_tasks"

    character_id: Mapped[int] = mapped_column(ForeignKey("characters.id"), primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), primary_key=True)
    # Rest gauge anchor: its value at the start of rest_period. The current
    # value is replayed from here using completions (see rest.py).
    rest_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rest_period: Mapped[date | None] = mapped_column(Date, nullable=True)


class Completion(Base):
    """A task checked off for one reset period.

    Old completions are kept rather than cleared on reset, so they double as
    the raid gold history. Gold is snapshotted at completion time so editing a
    task's gold value later doesn't rewrite past weeks.
    """

    __tablename__ = "completions"
    __table_args__ = (UniqueConstraint("character_id", "task_id", "period"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # Nulled out when the character or task is deleted so gold history survives.
    character_id: Mapped[int | None] = mapped_column(ForeignKey("characters.id"), nullable=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    # The date of the reset that started this period (daily or weekly).
    period: Mapped[date] = mapped_column(Date)
    completed_at: Mapped[datetime] = mapped_column(DateTime)
    gold: Mapped[int] = mapped_column(Integer, default=0)


class GoldEntry(Base):
    """Gold from sources outside raids, entered by hand (field boss, chaos gate, ...)."""

    __tablename__ = "gold_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(50))
    amount: Mapped[int] = mapped_column(Integer)
    character_id: Mapped[int | None] = mapped_column(ForeignKey("characters.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    earned_at: Mapped[datetime] = mapped_column(DateTime)
