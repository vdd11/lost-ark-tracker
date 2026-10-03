"""Raid difficulties and content tiers: item level, gold and gem rewards."""


from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import CharacterTask, RaidDifficulty, Task
from schemas import (
    DifficultyCreate,
    DifficultyRead,
    DifficultyUpdate,
)
from routes.common import get_or_404

router = APIRouter(prefix="/api")


@router.post("/tasks/{task_id}/difficulties", response_model=DifficultyRead, status_code=201)
def create_difficulty(task_id: int, data: DifficultyCreate, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)
    if task.category != "raid":
        raise HTTPException(status_code=400, detail="Only raids have difficulties")
    highest = db.query(func.max(RaidDifficulty.position)).filter_by(task_id=task_id).scalar()
    difficulty = RaidDifficulty(task_id=task_id, position=0 if highest is None else highest + 1, **data.model_dump())
    db.add(difficulty)
    db.commit()
    db.refresh(difficulty)
    return difficulty


@router.patch("/difficulties/{difficulty_id}", response_model=DifficultyRead)
def update_difficulty(difficulty_id: int, changes: DifficultyUpdate, db: Session = Depends(get_db)):
    difficulty = get_or_404(db, RaidDifficulty, difficulty_id)
    for field, value in changes.model_dump(exclude_unset=True).items():
        if field.endswith("_gems") and value is not None:
            value = {str(level): count for level, count in sorted(value.items()) if count > 0} or None
        setattr(difficulty, field, value)
    db.commit()
    db.refresh(difficulty)
    return difficulty


@router.post("/difficulties/{difficulty_id}/reset", response_model=DifficultyRead)
def reset_difficulty(difficulty_id: int, db: Session = Depends(get_db)):
    """Go back to the catalog's gold and item level."""
    difficulty = get_or_404(db, RaidDifficulty, difficulty_id)
    difficulty.gold = difficulty.catalog_gold
    if difficulty.catalog_bound_percent is not None:
        difficulty.bound_percent = difficulty.catalog_bound_percent
    if difficulty.catalog_bound_kind is not None:
        difficulty.bound_kind = difficulty.catalog_bound_kind
    if difficulty.catalog_item_level is not None:
        difficulty.bonus_cost = difficulty.catalog_bonus_cost
    if difficulty.catalog_item_level is not None:
        difficulty.min_item_level = difficulty.catalog_item_level
    for field, value in (difficulty.catalog_rewards or {}).items():
        setattr(difficulty, field, value)
    db.commit()
    db.refresh(difficulty)
    return difficulty


@router.delete("/difficulties/{difficulty_id}", status_code=204)
def delete_difficulty(difficulty_id: int, db: Session = Depends(get_db)):
    difficulty = get_or_404(db, RaidDifficulty, difficulty_id)
    if difficulty.catalog_item_level is not None:
        raise HTTPException(status_code=400, detail="Built-in difficulties can't be deleted")
    db.query(CharacterTask).filter_by(difficulty_id=difficulty_id).update({"difficulty_id": None})
    db.delete(difficulty)
    db.commit()
    return Response(status_code=204)
