"""Built-in raid catalog, synced into every database on startup.

Gold is the total for all gates. `None` means we don't have a confirmed
number yet: the app shows "?" and users can fill it in on the Raids page.
Sources: official NA release notes on playlostark.com, most recently
"Dimensions Unbound" (2026-09-16) for Act 4, Denouement and Serca gold.

Updating values here reaches existing users on their next launch, except
for values a user has edited themselves (see sync_raid_catalog).
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Character, CharacterTask, RaidDifficulty, Task

# Gold is only paid for this many raids per character per week.
GOLD_RAIDS_PER_WEEK = 3


@dataclass(frozen=True)
class Difficulty:
    name: str
    item_level: float
    gold: int | None


@dataclass(frozen=True)
class CatalogRaid:
    key: str
    name: str
    difficulties: list[Difficulty]
    # Extreme raids: limited-time, one clear per roster per week, gold for
    # any character, and outside the weekly gold-raid limit.
    ends_on: date | None = None
    roster_limited: bool = False
    gold_for_everyone: bool = False
    note: str | None = None
    legacy_names: list[str] = field(default_factory=list)


RAID_CATALOG = [
    CatalogRaid(
        key="kazeros-act-1",
        name="Act 1: Aegir",
        difficulties=[Difficulty("Normal", 1660, None), Difficulty("Hard", 1680, None)],
        legacy_names=["Aegir"],
    ),
    CatalogRaid(
        key="kazeros-act-2",
        name="Act 2: Brelshaza",
        difficulties=[Difficulty("Normal", 1670, None), Difficulty("Hard", 1690, None)],
        legacy_names=["Act 2: Brelshaza"],
    ),
    CatalogRaid(
        key="kazeros-act-3",
        name="Act 3: Mordum",
        difficulties=[Difficulty("Normal", 1680, None), Difficulty("Hard", 1700, None)],
        legacy_names=["Act 3: Mordum"],
    ),
    CatalogRaid(
        key="kazeros-act-4",
        name="Act 4: Fortress of Destruction",
        difficulties=[
            Difficulty("Solo", 1700, 27000),
            Difficulty("Normal", 1700, 27000),
            Difficulty("Hard", 1720, 38000),
        ],
        note="Solo pays half its gold as character-bound gold.",
        legacy_names=["Act 4: Armoche"],
    ),
    CatalogRaid(
        key="kazeros-denouement",
        name="Denouement: The Final Day",
        difficulties=[
            Difficulty("Solo", 1710, 32000),
            Difficulty("Normal", 1710, 32000),
            Difficulty("Hard", 1730, 48000),
            Difficulty("The First", 1740, None),
        ],
        note="Solo pays half its gold as character-bound gold.",
        legacy_names=["Final Act: Kazeros"],
    ),
    CatalogRaid(
        key="shadow-serca",
        name="Shadow Raid: Serca",
        difficulties=[
            Difficulty("Normal", 1710, 32000),
            Difficulty("Hard", 1730, None),
            Difficulty("Nightmare", 1740, None),
        ],
        note="4 players. Normal pays half its gold as roster-bound gold.",
    ),
    CatalogRaid(
        key="extreme-act-3",
        name="Act 3 Extreme",
        difficulties=[
            Difficulty("Normal", 1730, 20000),
            Difficulty("Hard", 1770, 50000),
            Difficulty("Nightmare", 1780, 50000),
        ],
        ends_on=date(2026, 10, 21),
        roster_limited=True,
        gold_for_everyone=True,
        note="Event raid: one clear per roster per week, gold for any character.",
    ),
]


def best_difficulty(difficulties: list[RaidDifficulty], item_level: float) -> RaidDifficulty | None:
    """The hardest group difficulty a character qualifies for, else the easiest one."""
    group = [d for d in difficulties if d.name != "Solo"] or difficulties
    if not group:
        return None
    eligible = [d for d in group if d.min_item_level <= item_level]
    if eligible:
        return max(eligible, key=lambda d: (d.min_item_level, d.position))
    return min(group, key=lambda d: (d.min_item_level, d.position))


def sync_raid_catalog(db: Session):
    """Add catalog raids and keep their values current.

    A difficulty's gold/item level follows the catalog until the user edits
    it: catalog_gold/catalog_item_level remember what we last wrote, and a
    value that no longer matches them was changed by the user.
    """
    tasks_by_key = {t.catalog_key: t for t in db.query(Task).filter(Task.catalog_key.is_not(None))}
    next_position = (db.query(func.max(Task.position)).scalar() or 0) + 1

    for raid in RAID_CATALOG:
        task = tasks_by_key.get(raid.key)

        # Adopt raid columns created by older versions, keeping assignments.
        if task is None and raid.legacy_names:
            task = (
                db.query(Task)
                .filter(Task.catalog_key.is_(None), Task.category == "raid", Task.name.in_(raid.legacy_names))
                .first()
            )
            if task is not None:
                task.catalog_key = raid.key
                task.name = raid.name

        if task is None:
            task = Task(name=raid.name, category="raid", catalog_key=raid.key, position=next_position)
            next_position += 1
            db.add(task)
            db.flush()

        task.ends_on = raid.ends_on
        task.roster_limited = raid.roster_limited
        task.gold_for_everyone = raid.gold_for_everyone
        task.note = raid.note

        existing = {d.name: d for d in db.query(RaidDifficulty).filter_by(task_id=task.id)}
        for position, spec in enumerate(raid.difficulties):
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
                ))
                continue

            if difficulty.gold == difficulty.catalog_gold:
                difficulty.gold = spec.gold
            if difficulty.min_item_level == difficulty.catalog_item_level:
                difficulty.min_item_level = spec.item_level
            difficulty.catalog_gold = spec.gold
            difficulty.catalog_item_level = spec.item_level
            difficulty.position = position

    db.flush()
    assign_missing_difficulties(db)
    db.commit()


def assign_missing_difficulties(db: Session):
    """Raid assignments without a difficulty get the best one for the character."""
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
