"""Raid difficulties and content tiers: item level, gold and gem rewards."""


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Character, Completion, RaidDifficulty, Task
from raids import CATALOG, CATALOG_REVIEWED
from resets import period_for, utc_now
from schemas import CatalogRaid, CatalogReference, DifficultyRead, DifficultyUpdate
from routes.common import get_or_404
from routes.tracker import price_completion

router = APIRouter(prefix="/api")

GEM_FIELDS = {"reward_gems", "lucky_gems", "mega_gems"}


@router.get("/raid-catalog", response_model=CatalogReference)
def get_raid_catalog():
    """The built-in raid values, read-only, for the in-app reference."""
    return CatalogReference(
        reviewed=CATALOG_REVIEWED,
        raids=[
            CatalogRaid(
                name=item.name,
                note=item.note,
                difficulties=[
                    {
                        "name": d.name,
                        "item_level": d.item_level,
                        "gold": d.gold,
                        "bound_percent": d.bound_percent,
                        "bound_kind": d.bound_kind,
                        "bonus_cost": d.bonus_cost,
                    }
                    for d in item.difficulties
                ],
            )
            for item in CATALOG
            if item.category == "raid"
        ],
    )


@router.patch("/difficulties/{difficulty_id}", response_model=DifficultyRead)
def update_difficulty(difficulty_id: int, changes: DifficultyUpdate, db: Session = Depends(get_db)):
    difficulty = get_or_404(db, RaidDifficulty, difficulty_id)
    updates = changes.model_dump(exclude_unset=True)
    if difficulty.catalog_item_level is not None:
        # Built-in values come with app updates; only gem tables the catalog
        # doesn't know yet can be filled in.
        known = {field for field, value in (difficulty.catalog_rewards or {}).items() if value is not None}
        if set(updates) - (GEM_FIELDS - known):
            raise HTTPException(status_code=400, detail="Built-in values come with app updates")
    # Clears made while a value was unknown recorded 0; once it's filled in,
    # this week's clears pick it up. Known values stay as recorded (history).
    filled_in = any(field in updates and getattr(difficulty, field) is None for field in ("gold", "bonus_cost"))
    for field, value in updates.items():
        if field.endswith("_gems") and value is not None:
            value = {str(level): count for level, count in sorted(value.items()) if count > 0} or None
        setattr(difficulty, field, value)
    db.flush()
    if filled_in:
        reprice_this_week(db, difficulty)
    db.commit()
    db.refresh(difficulty)
    return difficulty


def reprice_this_week(db: Session, difficulty: RaidDifficulty):
    task = db.get(Task, difficulty.task_id)
    period = period_for(task.category, utc_now())
    clears = db.query(Completion).filter_by(difficulty_id=difficulty.id, period=period).order_by(Completion.id)
    for clear in clears:
        character = db.get(Character, clear.character_id) if clear.character_id else None
        if character is not None:
            price_completion(db, character, task, clear)
