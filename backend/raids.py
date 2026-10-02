"""Built-in catalog of raids (and other tiered content), synced into every
database on startup.

Gold is the total for all gates. `None` means we don't have a confirmed
number: the app shows "?" and users can fill it in on the Raids page.
Sources: official NA release notes on playlostark.com ("Dimensions Unbound",
2026-09-16, for Act 4, Final Day and Serca Normal), guides for Horizon
Cathedral (2026-07-22), the user for Serca Hard/Nightmare, and the Ebony Cube
Loot Calculator spreadsheet by Ksfreaks for cube gems.

Updating values here reaches existing users on their next launch, except
for values a user has edited themselves (see sync_catalog).
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Character, CharacterTask, Completion, RaidDifficulty, Task

# Gold is only paid for this many raids per character per week.
GOLD_RAIDS_PER_WEEK = 3

# Defaults offered when adding an Extreme event (from the Act 1 and Act 2
# Extreme release notes). Users can adjust them before creating the event.
EXTREME_TEMPLATE = [("Normal", 1720, 20000), ("Hard", 1750, 45000), ("Nightmare", 1770, 45000)]
EVENT_NOTE = "Event raid: one clear per roster per week, gold for any character."
# Raids that have had (or may get) an Extreme version.
EXTREME_BASES = ["Act 1", "Act 2", "Act 3", "Act 4", "The Final Day", "Serca", "Thaemine"]


# Gem tables are {level: expected count}, string keys like the database's JSON.
Gems = dict[str, float]


@dataclass(frozen=True)
class Difficulty:
    name: str
    item_level: float
    gold: int | None
    # Expected gems per run / lucky room / mega lucky room; None = unknown.
    reward_gems: Gems | None = None
    lucky_gems: Gems | None = None
    mega_gems: Gems | None = None

    def rewards(self) -> dict:
        return {"reward_gems": self.reward_gems, "lucky_gems": self.lucky_gems, "mega_gems": self.mega_gems}


@dataclass(frozen=True)
class CatalogTask:
    key: str
    name: str
    difficulties: list[Difficulty]
    category: str = "raid"
    counted: bool = False
    sand_scaled: bool = False
    note: str | None = None
    # Earlier names, so existing columns are adopted (and renamed) instead of duplicated.
    legacy_names: list[str] = field(default_factory=list)


CATALOG = [
    CatalogTask(
        key="shadow-serca",
        name="Serca",
        difficulties=[
            Difficulty("Normal", 1710, 32000),
            Difficulty("Hard", 1730, 44000),
            Difficulty("Nightmare", 1740, 54000),
        ],
        note="Shadow Raid, 4 players. Normal pays half its gold as roster-bound gold.",
        legacy_names=["Shadow Raid: Serca"],
    ),
    CatalogTask(
        key="abyss-cathedral",
        name="Horizon Cathedral",
        difficulties=[
            Difficulty("Lv1", 1700, 30000),
            Difficulty("Lv2", 1720, 40000),
            Difficulty("Lv3", 1750, 50000),
        ],
        note="Abyssal Dungeon, 4 players. Gold is character-bound.",
    ),
    CatalogTask(
        key="kazeros-denouement",
        name="The Final Day",
        difficulties=[Difficulty("Normal", 1710, 32000), Difficulty("Hard", 1730, 48000)],
        legacy_names=["Final Act: Kazeros", "Denouement: The Final Day"],
    ),
    CatalogTask(
        key="kazeros-act-4",
        name="Act 4",
        difficulties=[Difficulty("Normal", 1700, 27000), Difficulty("Hard", 1720, 38000)],
        note="Fortress of Destruction.",
        legacy_names=["Act 4: Armoche", "Act 4: Fortress of Destruction"],
    ),
    CatalogTask(
        key="ebony-cube",
        name="Ebony Cube",
        category="weekly",
        counted=True,
        # Gems per ticket in Lv2 equivalents, from the "Ebony Cube Loot
        # Calculator" sheet by Ksfreaks (Tier 4 unlocks only).
        difficulties=[
            Difficulty("1st", 1640, 0, reward_gems={"2": 6}),
            Difficulty("2nd", 1680, 0, reward_gems={"2": 12}),
            Difficulty("3rd", 1700, 0, reward_gems={"2": 16}),
            Difficulty("4th", 1720, 0, reward_gems={"2": 22}),
        ],
        note="Runs depend on tickets, so count them.",
    ),
    CatalogTask(
        key="haals-hourglass",
        name="Haal's Hourglass",
        category="weekly",
        sand_scaled=True,
        difficulties=[
            # Base reward: 15 Lv2 gem chests (one random Lv2 gem each).
            Difficulty("Lv1", 1730, 0, reward_gems={"2": 15}),
            Difficulty("Lv2", 1750, 0),
        ],
        note="Once a week. Sands of Trial (up to 5) multiply the rewards.",
    ),
]


def best_difficulty(difficulties: list[RaidDifficulty], item_level: float) -> RaidDifficulty | None:
    """The hardest difficulty a character qualifies for, else the easiest one."""
    if not difficulties:
        return None
    eligible = [d for d in difficulties if d.min_item_level <= item_level]
    if eligible:
        return max(eligible, key=lambda d: (d.min_item_level, d.position))
    return min(difficulties, key=lambda d: (d.min_item_level, d.position))


def sync_catalog(db: Session):
    """Add catalog tasks and keep their values current.

    A difficulty's gold/item level follows the catalog until the user edits
    it: catalog_gold/catalog_item_level remember what we last wrote, and a
    value that no longer matches them was changed by the user.
    """
    catalog_keys = {item.key for item in CATALOG}
    tasks_by_key = {t.catalog_key: t for t in db.query(Task).filter(Task.catalog_key.is_not(None))}
    next_position = (db.query(func.max(Task.position)).scalar() or 0) + 1

    # Tasks dropped from the catalog become ordinary custom tasks, data intact.
    for key, task in tasks_by_key.items():
        if key not in catalog_keys:
            task.catalog_key = None
            db.query(RaidDifficulty).filter_by(task_id=task.id).update(
                {"catalog_gold": None, "catalog_item_level": None}
            )

    for item in CATALOG:
        task = tasks_by_key.get(item.key)

        if task is None and item.legacy_names:
            task = (
                db.query(Task)
                .filter(Task.category == item.category, Task.name.in_(item.legacy_names))
                .filter((Task.catalog_key.is_(None)) | (Task.catalog_key.not_in(catalog_keys)))
                .first()
            )
            if task is not None:
                task.catalog_key = item.key

        if task is None:
            task = Task(name=item.name, category=item.category, catalog_key=item.key, position=next_position)
            next_position += 1
            db.add(task)
            db.flush()
            if item.category != "raid":
                # Like other dailies/weeklies, new ones apply to every character.
                for character in db.query(Character):
                    db.add(CharacterTask(character_id=character.id, task_id=task.id))

        # Rename only names we gave it, never a name the user chose.
        if task.name in item.legacy_names:
            task.name = item.name
        task.category = item.category
        task.counted = item.counted
        task.sand_scaled = item.sand_scaled
        task.note = item.note

        sync_difficulties(db, task, item.difficulties)

    db.flush()
    assign_missing_difficulties(db)
    db.commit()


def sync_difficulties(db: Session, task: Task, specs: list[Difficulty]):
    existing = {d.name: d for d in db.query(RaidDifficulty).filter_by(task_id=task.id)}
    wanted = {spec.name for spec in specs}

    # Built-in difficulties the game removed (e.g. The First): move anyone on
    # them to their best remaining difficulty.
    for name, difficulty in existing.items():
        if name not in wanted and difficulty.catalog_item_level is not None:
            db.query(CharacterTask).filter_by(difficulty_id=difficulty.id).update({"difficulty_id": None})
            db.query(Completion).filter_by(difficulty_id=difficulty.id).update({"difficulty_id": None})
            db.delete(difficulty)

    for position, spec in enumerate(specs):
        difficulty = existing.get(spec.name)
        if difficulty is None:
            db.add(RaidDifficulty(
                task_id=task.id,
                name=spec.name,
                position=position,
                min_item_level=spec.item_level,
                gold=spec.gold,
                catalog_item_level=spec.item_level,
                catalog_gold=spec.gold,
                **spec.rewards(),
                catalog_rewards=spec.rewards(),
            ))
            continue

        if difficulty.gold == difficulty.catalog_gold:
            difficulty.gold = spec.gold
        if difficulty.min_item_level == difficulty.catalog_item_level:
            difficulty.min_item_level = spec.item_level
        difficulty.catalog_gold = spec.gold
        difficulty.catalog_item_level = spec.item_level
        difficulty.position = position

        previous = difficulty.catalog_rewards or {}
        for field, value in spec.rewards().items():
            if getattr(difficulty, field) == previous.get(field):
                setattr(difficulty, field, value)
        difficulty.catalog_rewards = spec.rewards()


def assign_missing_difficulties(db: Session):
    """Assignments to tiered tasks without a tier get the best one for the character."""
    difficulties_by_task: dict[int, list[RaidDifficulty]] = {}
    for difficulty in db.query(RaidDifficulty):
        difficulties_by_task.setdefault(difficulty.task_id, []).append(difficulty)

    rows = (
        db.query(CharacterTask, Character)
        .join(Character, Character.id == CharacterTask.character_id)
        .filter(CharacterTask.difficulty_id.is_(None), CharacterTask.task_id.in_(difficulties_by_task))
    )
    for assignment, character in rows:
        chosen = best_difficulty(difficulties_by_task[assignment.task_id], character.item_level)
        assignment.difficulty_id = chosen.id if chosen else None


def is_active(task: Task, today: date) -> bool:
    return not task.archived and (task.ends_on is None or task.ends_on > today)
