from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TaskCategory = Literal["daily", "weekly", "raid"]
BoundKind = Literal["roster", "character"]


class RaidChoice(BaseModel):
    task_id: int
    # Omit to pick the hardest difficulty the character qualifies for.
    difficulty_id: int | None = None


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    class_name: str = Field(min_length=1, max_length=50)
    item_level: float = 0
    is_gold_earner: bool = True
    raids: list[RaidChoice] = []


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    class_name: str | None = Field(default=None, min_length=1, max_length=50)
    item_level: float | None = None
    is_gold_earner: bool | None = None
    position: int | None = None


class CharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    class_name: str
    item_level: float
    is_gold_earner: bool
    position: int
    task_ids: list[int] = []
    # task_id -> difficulty_id for assigned raids that have difficulties.
    difficulty_ids: dict[int, int] = {}


class AssignTask(BaseModel):
    difficulty_id: int | None = None


class TaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: TaskCategory
    gold: int = Field(default=0, ge=0)
    rest_max: int = Field(default=0, ge=0)
    rest_gain: int = Field(default=0, ge=0)
    rest_cost: int = Field(default=0, ge=0)


class TaskUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: TaskCategory | None = None
    gold: int | None = Field(default=None, ge=0)
    position: int | None = None
    rest_max: int | None = Field(default=None, ge=0)
    rest_gain: int | None = Field(default=None, ge=0)
    rest_cost: int | None = Field(default=None, ge=0)
    archived: bool | None = None


class DifficultyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    min_item_level: float = Field(default=0, ge=0)
    gold: int | None = Field(default=None, ge=0)
    bound_percent: int = Field(default=0, ge=0, le=100)
    bound_kind: BoundKind = "roster"
    bonus_cost: int | None = Field(default=None, ge=0)


GemTable = dict[int, float]


def check_gem_table(table: GemTable | None) -> GemTable | None:
    for level, count in (table or {}).items():
        if not 1 <= level <= 10 or count < 0:
            raise ValueError("Gem levels are 1-10 and counts can't be negative")
    return table


class DifficultyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    min_item_level: float | None = Field(default=None, ge=0)
    gold: int | None = Field(default=None, ge=0)
    bound_percent: int | None = Field(default=None, ge=0, le=100)
    bound_kind: BoundKind | None = None
    bonus_cost: int | None = Field(default=None, ge=0)
    reward_gems: GemTable | None = None
    lucky_gems: GemTable | None = None
    mega_gems: GemTable | None = None

    _check_gems = field_validator("reward_gems", "lucky_gems", "mega_gems")(check_gem_table)


class DifficultyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    name: str
    position: int
    min_item_level: float
    gold: int | None
    catalog_item_level: float | None
    catalog_gold: int | None
    bound_percent: int = 0
    catalog_bound_percent: int | None = None
    bound_kind: BoundKind = "roster"
    catalog_bound_kind: BoundKind | None = None
    bonus_cost: int | None = None
    catalog_bonus_cost: int | None = None
    reward_gems: GemTable | None = None
    lucky_gems: GemTable | None = None
    mega_gems: GemTable | None = None
    catalog_rewards: dict | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: TaskCategory
    gold: int
    position: int
    rest_max: int
    rest_gain: int
    rest_cost: int
    catalog_key: str | None
    archived: bool
    ends_on: date | None
    roster_limited: bool
    gold_for_everyone: bool
    note: str | None
    counted: bool
    sand_scaled: bool
    difficulties: list[DifficultyRead] = []


class EventRaidCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    ends_on: date
    difficulties: list[DifficultyCreate] = Field(min_length=1)


class EventTemplate(BaseModel):
    bases: list[str]
    difficulties: list[DifficultyCreate]


class CompletionUpdate(BaseModel):
    # Which difficulty was run; defaults to the character's usual one.
    difficulty_id: int | None = None
    # Runs this period for counted tasks; 0 removes the completion.
    count: int | None = Field(default=None, ge=0)
    lucky_rooms: int | None = Field(default=None, ge=0)
    mega_rooms: int | None = Field(default=None, ge=0)
    # Sands of Trial spent (Haal's Hourglass), up to 5.
    sands: int | None = Field(default=None, ge=0, le=5)
    # Bought the bonus ("View More") chests for this clear.
    bought_bonus: bool | None = None
    # Counted tasks: runs per tier {difficulty_id: runs}. `count` sets the
    # runs at the character's own tier; this sets any tier.
    tier_counts: dict[int, int] | None = None

    @field_validator("tier_counts")
    @classmethod
    def check_tier_counts(cls, tiers: dict[int, int] | None) -> dict[int, int] | None:
        if tiers and any(runs < 0 for runs in tiers.values()):
            raise ValueError("Run counts can't be negative")
        return tiers


class Run(BaseModel):
    character_id: int
    task_id: int
    difficulty_id: int | None
    count: int
    lucky_rooms: int = 0
    mega_rooms: int = 0
    sands: int = 0
    bought_bonus: bool = False
    bonus_spent: int = 0
    tier_counts: dict[int, int] | None = None
    # Expected gems from this run, {level: count}.
    gems: GemTable | None = None


class RestState(BaseModel):
    character_id: int
    task_id: int
    # What the game should be showing right now (after today's run, if done).
    value: int
    # Today's run hasn't happened yet and will spend rest for bonus rewards.
    rested_run_available: bool


class RestUpdate(BaseModel):
    value: int = Field(ge=0)


class TrackerState(BaseModel):
    """Everything the tracker grid needs about the current reset periods."""

    daily_period: date
    weekly_period: date
    next_daily_reset: datetime
    next_weekly_reset: datetime
    # [character_id, task_id] pairs completed in the current period.
    completed: list[tuple[int, int]]
    runs: list[Run] = []
    rest: list[RestState] = []


class GoldEntryCreate(BaseModel):
    source: str = Field(min_length=1, max_length=50)
    amount: int = Field(gt=0)
    character_id: int | None = None
    note: str | None = Field(default=None, max_length=200)
    earned_at: datetime | None = None


class GoldEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    amount: int
    character_id: int | None
    note: str | None
    earned_at: datetime


class WeeklyGold(BaseModel):
    week: date
    raid_gold: int
    other_gold: int
    total: int
    # Part of raid_gold that was bound (can't be traded), and of that the
    # character-bound part; the rest of bound_gold is roster-bound.
    bound_gold: int = 0
    character_bound_gold: int = 0
    # Gold spent on bonus ("View More") chests; net = total - bonus_spent.
    bonus_spent: int = 0
    net: int = 0
    by_source: dict[str, int]
    # Character name -> net gold (raid clears plus logged gold tied to them,
    # minus bonus chests they bought).
    by_character: dict[str, int] = {}


class GemEntryCreate(BaseModel):
    source: str = Field(min_length=1, max_length=50)
    character_id: int | None = None
    # Gem level -> how many of that level.
    gems: dict[int, int]
    note: str | None = Field(default=None, max_length=200)
    earned_at: datetime | None = None

    @field_validator("gems")
    @classmethod
    def check_gems(cls, gems: dict[int, int]) -> dict[int, int]:
        for level, count in gems.items():
            if not 1 <= level <= 10 or count < 0:
                raise ValueError("Gem levels are 1-10 and counts can't be negative")
        return gems


class GemEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    character_id: int | None
    gems: dict[int, int]
    note: str | None
    earned_at: datetime


class WeeklyGems(BaseModel):
    week: date
    # Level-1 equivalents: a level-n gem counts as 3^(n-1). Tracked runs use
    # expected (average) rewards, so these can be fractional.
    total: float
    by_source: dict[str, float]
    by_level: dict[int, float]
    by_character: dict[str, float] = {}
