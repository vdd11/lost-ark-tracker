from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TaskCategory = Literal["daily", "weekly", "raid"]
BoundKind = Literal["roster", "character"]
SpendingCategory = Literal["honing", "gems", "market", "other"]
PaidFrom = Literal["bound_first", "tradeable"]


class RaidChoice(BaseModel):
    task_id: int
    # Omit to pick the hardest difficulty the character qualifies for.
    difficulty_id: int | None = None


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    position: int | None = None


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    position: int
    characters: int = 0


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    class_name: str = Field(min_length=1, max_length=50)
    item_level: float = 0
    is_gold_earner: bool = True
    # Defaults to the first account.
    account_id: int | None = None
    raids: list[RaidChoice] = []


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    class_name: str | None = Field(default=None, min_length=1, max_length=50)
    item_level: float | None = None
    is_gold_earner: bool | None = None
    position: int | None = None
    account_id: int | None = None
    # Send null to clear a blessing.
    azena_until: date | None = None
    inanna_until: date | None = None


class CharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    class_name: str
    item_level: float
    is_gold_earner: bool
    position: int
    account_id: int = 1
    azena_until: date | None = None
    inanna_until: date | None = None
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


class CatalogDifficulty(BaseModel):
    name: str
    item_level: float
    gold: int | None
    bound_percent: int
    bound_kind: BoundKind
    bonus_cost: int | None


class CatalogRaid(BaseModel):
    name: str
    note: str | None
    difficulties: list[CatalogDifficulty]


class CatalogReference(BaseModel):
    reviewed: str
    raids: list[CatalogRaid]


class CompletionUpdate(BaseModel):
    # Which difficulty was run; defaults to the character's usual one.
    difficulty_id: int | None = None
    # Runs this period for counted tasks; 0 removes the completion.
    count: int | None = Field(default=None, ge=0)
    lucky_rooms: int | None = Field(default=None, ge=0)
    mega_rooms: int | None = Field(default=None, ge=0)
    # Sands of Trial spent (Haal's Hourglass), up to 5.
    sands: int | None = Field(default=None, ge=0, le=5)
    # Embers a daily dropped, as the player logs them.
    fate_embers: int | None = Field(default=None, ge=0)
    blessed_embers: int | None = Field(default=None, ge=0)
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
    fate_embers: int = 0
    blessed_embers: int = 0
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


class EmberWeek(BaseModel):
    """Embers a character logged from dailies since the weekly reset."""

    character_id: int
    fate: int
    blessed: int


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
    embers: list[EmberWeek] = []


class GoldEntryCreate(BaseModel):
    source: str = Field(min_length=1, max_length=50)
    amount: int = Field(gt=0)
    character_id: int | None = None
    # Only for gold not tied to a character.
    account_id: int | None = None
    note: str | None = Field(default=None, max_length=200)
    earned_at: datetime | None = None


class GoldEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    amount: int
    character_id: int | None
    account_id: int | None = None
    note: str | None
    earned_at: datetime


class PriceRead(BaseModel):
    key: str
    name: str
    price: float | None
    per: int
    # Gold per single unit, or None while no price is set.
    unit_price: float | None
    hidden: bool
    builtin: bool
    tools: list[str] = []
    updated_at: datetime | None


class PriceUpdate(BaseModel):
    price: float | None = Field(default=None, ge=0)
    per: int | None = Field(default=None, ge=1, le=100_000)
    hidden: bool | None = None
    # Custom items only.
    name: str | None = Field(default=None, min_length=1, max_length=100)


class PriceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float | None = Field(default=None, ge=0)
    per: int = Field(default=1, ge=1, le=100_000)


class SpendingCreate(BaseModel):
    category: SpendingCategory
    amount: int = Field(gt=0)
    # Market purchases can only use tradeable gold; the rest defaults to bound first.
    paid_from: PaidFrom | None = None
    character_id: int | None = None
    account_id: int | None = None
    note: str | None = Field(default=None, max_length=200)
    spent_at: datetime | None = None


class SpendingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: SpendingCategory
    amount: int
    paid_from: PaidFrom
    character_id: int | None
    account_id: int | None
    note: str | None
    spent_at: datetime


def web_address(url: str | None) -> str | None:
    """Links open in the browser: only http(s), never javascript: or file:.
    "discord.gg/abc" becomes "https://discord.gg/abc"."""
    if url is None:
        return None
    url = url.strip()
    host = url.split("/")[0]
    if "://" not in url and "." in host and ":" not in host and " " not in url:
        url = f"https://{url}"
    if not url.lower().startswith(("http://", "https://")) or " " in url or len(url) < 11:
        raise ValueError("Use a web address starting with https://")
    return url


class CounterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    value: int = Field(default=0, ge=0, le=1_000_000_000)
    target: int | None = Field(default=None, ge=1, le=1_000_000_000)
    character_id: int | None = None
    account_id: int | None = None


class CounterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    value: int | None = Field(default=None, ge=0, le=1_000_000_000)
    target: int | None = Field(default=None, ge=1, le=1_000_000_000)
    # Change the value by this much (the +1 / -1 buttons); never below 0.
    add: int | None = Field(default=None, ge=-1_000_000, le=1_000_000)
    position: int | None = None


class CounterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    value: int
    target: int | None
    character_id: int | None
    account_id: int | None
    position: int


class RaidGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    task_id: int | None = None
    schedule: str | None = Field(default=None, max_length=100)
    members: list[str] = Field(default=[], max_length=16)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("members")
    @classmethod
    def clean_members(cls, members: list[str]) -> list[str]:
        cleaned = [m.strip()[:50] for m in members if m.strip()]
        return list(dict.fromkeys(cleaned))


class RaidGroupUpdate(RaidGroupCreate):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    members: list[str] | None = Field(default=None, max_length=16)
    position: int | None = None


class RaidGroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    task_id: int | None
    schedule: str | None
    members: list[str]
    notes: str | None
    position: int


class GuideLinkCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=300)
    category: str = Field(default="My links", min_length=1, max_length=50)

    _check_url = field_validator("url")(web_address)


class GuideLinkUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    url: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=300)
    category: str | None = Field(default=None, min_length=1, max_length=50)

    _check_url = field_validator("url")(web_address)


class GuideLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    url: str
    description: str | None
    category: str
    position: int


class GuidesRead(BaseModel):
    links: list[GuideLinkRead]
    hidden: list[str]


class BoundGoldSet(BaseModel):
    amount: int = Field(ge=0, le=1_000_000_000)


class BalancesOut(BaseModel):
    tradeable: int
    roster_bound: int
    # character_id -> gold
    character_bound: dict[int, int] = {}
    total: int


class BalanceCheckCreate(BaseModel):
    tradeable: int = Field(ge=0)
    roster_bound: int = Field(ge=0)
    character_bound: dict[int, int] = {}
    note: str | None = Field(default=None, max_length=200)
    checked_at: datetime | None = None
    # Defaults to the first account.
    account_id: int | None = None


class BalanceCheckRead(BaseModel):
    id: int
    account_id: int
    checked_at: datetime
    actual: BalancesOut
    note: str | None
    # From the previous check-in plus tracked gold since; None for the first.
    expected: BalancesOut | None = None
    # expected - actual: positive means gold went to things the app doesn't track.
    untracked: BalancesOut | None = None


class ExpectedBalances(BaseModel):
    last_check_in: datetime
    expected: BalancesOut


class CharacterBoundGold(BaseModel):
    """One character's character-bound gold for a week."""

    earned: int = 0
    # Bonus chests are paid from character-bound gold first.
    spent: int = 0
    left: int = 0


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
    # What's left after bonus chests, which spend gold in the game's order:
    # the buyer's character-bound gold, then roster-bound, then tradeable.
    tradeable_left: int = 0
    roster_bound_left: int = 0
    character_bound_left: int = 0
    # character_id -> that character's character-bound gold this week.
    character_bound: dict[int, CharacterBoundGold] = {}
    # Gold spent on untracked things, from check-ins made this week.
    untracked_spent: int | None = None


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


class GemTotal(BaseModel):
    # Level-1 equivalents, like WeeklyGems.total.
    total: float


class ServerStatus(BaseModel):
    region: str
    name: str
    # As the official page labels it: good, busy, full or maintenance.
    status: str


class NewsItem(BaseModel):
    title: str
    url: str
    date: datetime


class NewsFeed(BaseModel):
    servers: list[ServerStatus] = []
    servers_error: str | None = None
    news: list[NewsItem] = []
    news_error: str | None = None


class WeekRecap(BaseModel):
    # Start of last week's reset period.
    week: date
    # character_id -> raid clears that paid gold last week.
    paid_raids: dict[int, int] = {}


class LoaLogsPath(BaseModel):
    path: str | None
    exists: bool


class LoaPreviewRequest(BaseModel):
    # encounters.db; the usual install location when empty.
    path: str | None = None
    # Only clears after this (the last import); never before this week's reset.
    since: datetime | None = None
    # LOA Logs boss name -> task id (0 = ignore), on top of the suggested mapping.
    mapping: dict[str, int] | None = None


class LoaClear(BaseModel):
    fight_start: datetime
    boss: str
    difficulty: str | None
    character_id: int
    character_name: str
    task_id: int
    task_name: str
    # None when LOA Logs' difficulty name isn't one of the raid's.
    difficulty_id: int | None
    already_done: bool


class LoaPreview(BaseModel):
    path: str
    since: datetime
    clears: list[LoaClear]
    unknown_bosses: list[str]
    unknown_players: list[str]
    suggested_mapping: dict[str, int]
    # Whether LOA Logs' encounters.json was found to suggest boss -> raid.
    raid_map_found: bool


class CharacterWeek(BaseModel):
    week: date
    # Raid clears, and how many paid gold (event raids don't use a slot).
    raids: int = 0
    paid_raids: int = 0
    # Raid gold after bonus boxes, plus gold logged for the character.
    gold: int = 0


class WeeklyHistory(BaseModel):
    weeks: list[date]
    # character_id -> one entry per week (only characters with any history).
    characters: dict[int, list[CharacterWeek]] = {}
