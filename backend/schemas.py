from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaskCategory = Literal["daily", "weekly", "raid"]


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    class_name: str = Field(min_length=1, max_length=50)
    item_level: float = 0
    is_gold_earner: bool = True
    reserved_for: str | None = None


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
