from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TaskCategory = Literal["daily", "weekly", "raid"]


class RaidChoice(BaseModel):
    task_id: int
    # Omit to pick the hardest difficulty the character qualifies for.
    difficulty_id: int | None = None


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    class_name: str = Field(min_length=1, max_length=50)
    item_level: float = 0
    is_gold_earner: bool = True
    reserved_for: str | None = None
    raids: list[RaidChoice] = []


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    class_name: str | None = Field(default=None, min_length=1, max_length=50)
    item_level: float | None = None
    is_gold_earner: bool | None = None
    reserved_for: str | None = None
    position: int | None = None


class CharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    class_name: str
    item_level: float
    is_gold_earner: bool
    reserved_for: str | None
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


class DifficultyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    min_item_level: float | None = Field(default=None, ge=0)
    gold: int | None = Field(default=None, ge=0)


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


class Run(BaseModel):
    character_id: int
    task_id: int
    difficulty_id: int | None
    count: int


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
    by_source: dict[str, int]


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
    # Level-1 equivalents: a level-n gem counts as 3^(n-1).
    total: int
    by_source: dict[str, int]
    by_level: dict[int, int]
