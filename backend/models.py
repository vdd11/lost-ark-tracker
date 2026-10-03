from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
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
    # Raids from the built-in catalog (raids.py). Deleting one archives it so
    # the next catalog sync doesn't bring it back.
    catalog_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    # Limited-time raids disappear from the tracker on this date.
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    roster_limited: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    gold_for_everyone: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Tracked as a number of runs per period instead of a checkbox (Ebony Cube).
    counted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    # Rewards scale with Sands of Trial spent (Haal's Hourglass).
    sand_scaled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


class RaidDifficulty(Base):
    """One tier of a task: a raid difficulty (Normal, Hard, ...) or a cube unlock,
    each with its own item level and gold."""

    __tablename__ = "raid_difficulties"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    name: Mapped[str] = mapped_column(String(50))
    position: Mapped[int] = mapped_column(Integer, default=0)
    min_item_level: Mapped[float] = mapped_column(Float, default=0)
    # Total gold for all gates; None when not known yet.
    gold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Share of that gold paid as bound (untradeable) gold, 0-100, and whether
    # it's bound to the roster or to the character.
    bound_percent: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    bound_kind: Mapped[str] = mapped_column(String(20), default="roster", server_default="roster")
    # Gold to open the bonus ("View More") chests of every gate; None = unknown.
    bonus_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # What the catalog last set, to tell user edits apart from catalog values.
    catalog_item_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    catalog_gold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    catalog_bound_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    catalog_bound_kind: Mapped[str | None] = mapped_column(String(20), nullable=True)
    catalog_bonus_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Expected gems as {level: count} (counts may be averages); None = unknown.
    # Per run, per lucky room, and per mega lucky room.
    reward_gems: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    lucky_gems: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    mega_gems: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    # The three gem tables as the catalog last set them, like catalog_gold.
    catalog_rewards: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)


class CharacterTask(Base):
    """Which tasks a character does. Unassigned cells show as N/A in the tracker."""

    __tablename__ = "character_tasks"

    character_id: Mapped[int] = mapped_column(ForeignKey("characters.id"), primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), primary_key=True)
    # Rest gauge anchor: its value at the start of rest_period. The current
    # value is replayed from here using completions (see rest.py).
    rest_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rest_period: Mapped[date | None] = mapped_column(Date, nullable=True)
    # For raids with difficulties: which one this character runs.
    difficulty_id: Mapped[int | None] = mapped_column(ForeignKey("raid_difficulties.id"), nullable=True)


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
    # The part of `gold` that was bound, and of that, the character-bound part
    # (the rest is roster-bound).
    bound_gold: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    character_bound_gold: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Bonus ("View More") chests bought for this clear, and what they cost.
    bought_bonus: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    bonus_spent: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # The difficulty actually run, which can differ from the usual one.
    difficulty_id: Mapped[int | None] = mapped_column(ForeignKey("raid_difficulties.id"), nullable=True)
    # Runs this period, for counted tasks, and how they split across tiers
    # ({difficulty_id: runs}; Ebony Cube tickets can be for lower unlocks).
    count: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    tier_counts: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)
    lucky_rooms: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    mega_rooms: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sands: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Expected gems from this run, snapshotted like gold so later edits to
    # the reward tables don't rewrite past weeks.
    gems: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)


class GoldEntry(Base):
    """Gold from sources outside raids, entered by hand (field boss, chaos gate, ...)."""

    __tablename__ = "gold_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(50))
    amount: Mapped[int] = mapped_column(Integer)
    character_id: Mapped[int | None] = mapped_column(ForeignKey("characters.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    earned_at: Mapped[datetime] = mapped_column(DateTime)


class GemEntry(Base):
    """Gems from one drop or session, e.g. {"1": 3, "2": 1} for three Lv1 and one Lv2."""

    __tablename__ = "gem_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(50))
    character_id: Mapped[int | None] = mapped_column(ForeignKey("characters.id"), nullable=True)
    # Gem level (as a string, JSON keys) -> count.
    gems: Mapped[dict] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    earned_at: Mapped[datetime] = mapped_column(DateTime)
