"""Characters and which tasks (and raid difficulties) they do."""


from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import get_db
from accounts import first_account_id
from models import Account, Character, CharacterTask, Completion, GoldEntry, RaidDifficulty, Task
from schemas import (
    AssignTask,
    CharacterCreate,
    CharacterRead,
    CharacterUpdate,
)
from raids import best_difficulty
from routes.common import get_or_404, next_position

router = APIRouter(prefix="/api")


def to_character_read(character: Character, assignments: list[CharacterTask]) -> CharacterRead:
    return CharacterRead.model_validate(character).model_copy(update={
        "task_ids": [a.task_id for a in assignments],
        "difficulty_ids": {a.task_id: a.difficulty_id for a in assignments if a.difficulty_id is not None},
    })


def read_character(db: Session, character: Character) -> CharacterRead:
    return to_character_read(character, db.query(CharacterTask).filter_by(character_id=character.id).all())


@router.get("/characters", response_model=list[CharacterRead])
def get_characters(db: Session = Depends(get_db)):
    characters = db.query(Character).order_by(Character.position, Character.id).all()

    assignments_by_character: dict[int, list[CharacterTask]] = {}
    for assignment in db.query(CharacterTask).all():
        assignments_by_character.setdefault(assignment.character_id, []).append(assignment)

    return [to_character_read(c, assignments_by_character.get(c.id, [])) for c in characters]


def choose_difficulty(db: Session, task: Task, character: Character, difficulty_id: int | None) -> int | None:
    """Validate a requested difficulty, or pick the best one for the character."""
    difficulties = db.query(RaidDifficulty).filter_by(task_id=task.id).all()
    if difficulty_id is not None:
        if difficulty_id not in {d.id for d in difficulties}:
            raise HTTPException(status_code=400, detail=f"That difficulty isn't part of {task.name}")
        return difficulty_id
    chosen = best_difficulty(difficulties, character.item_level)
    return chosen.id if chosen else None


def check_account(db: Session, account_id: int | None) -> int:
    if account_id is None:
        return first_account_id(db)
    return get_or_404(db, Account, account_id).id


@router.post("/characters", response_model=CharacterRead, status_code=201)
def create_character(character_data: CharacterCreate, db: Session = Depends(get_db)):
    character = Character(
        **character_data.model_dump(exclude={"raids", "account_id"}),
        account_id=check_account(db, character_data.account_id),
        position=next_position(db, Character),
    )

    db.add(character)
    db.flush()

    # New characters start with every daily and weekly; raids are opted into
    # per character since they depend on item level.
    for task in db.query(Task).filter(Task.category.in_(["daily", "weekly"]), Task.archived.is_(False)):
        db.add(CharacterTask(
            character_id=character.id,
            task_id=task.id,
            difficulty_id=choose_difficulty(db, task, character, None),
        ))

    for choice in {c.task_id: c for c in character_data.raids}.values():
        task = get_or_404(db, Task, choice.task_id)
        if task.category != "raid":
            raise HTTPException(status_code=400, detail=f"{task.name} isn't a raid")
        db.add(CharacterTask(
            character_id=character.id,
            task_id=task.id,
            difficulty_id=choose_difficulty(db, task, character, choice.difficulty_id),
        ))

    db.commit()
    db.refresh(character)

    return read_character(db, character)


@router.patch("/characters/{character_id}", response_model=CharacterRead)
def update_character(character_id: int, changes: CharacterUpdate, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)
    old_item_level = character.item_level
    if changes.account_id is not None:
        check_account(db, changes.account_id)

    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(character, field, value)

    if character.item_level != old_item_level:
        follow_item_level(db, character, old_item_level)

    db.commit()
    db.refresh(character)

    return read_character(db, character)


def follow_item_level(db: Session, character: Character, old_item_level: float):
    """Move assignments that were on the best tier for the old item level to the new best."""
    for assignment in db.query(CharacterTask).filter_by(character_id=character.id):
        if assignment.difficulty_id is None:
            continue
        difficulties = db.query(RaidDifficulty).filter_by(task_id=assignment.task_id).all()
        old_best = best_difficulty(difficulties, old_item_level)
        if old_best is not None and old_best.id == assignment.difficulty_id:
            assignment.difficulty_id = best_difficulty(difficulties, character.item_level).id


@router.delete("/characters/{character_id}", status_code=204)
def delete_character(character_id: int, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)

    db.query(CharacterTask).filter(CharacterTask.character_id == character_id).delete()
    # Keep gold history, just detach it from the deleted character.
    db.query(Completion).filter(Completion.character_id == character_id).update({"character_id": None})
    db.query(GoldEntry).filter(GoldEntry.character_id == character_id).update({"character_id": None})
    db.delete(character)
    db.commit()

    return Response(status_code=204)


@router.put("/characters/{character_id}/tasks/{task_id}", status_code=204)
def assign_task(character_id: int, task_id: int, body: AssignTask | None = None, db: Session = Depends(get_db)):
    """Assign a task, or for a raid, change which difficulty the character runs."""
    character = get_or_404(db, Character, character_id)
    task = get_or_404(db, Task, task_id)
    difficulty_id = choose_difficulty(db, task, character, body.difficulty_id if body else None)

    assignment = db.get(CharacterTask, (character_id, task_id))
    if assignment is None:
        db.add(CharacterTask(character_id=character_id, task_id=task_id, difficulty_id=difficulty_id))
    elif body is not None and body.difficulty_id is not None:
        assignment.difficulty_id = difficulty_id
    db.commit()

    return Response(status_code=204)


@router.delete("/characters/{character_id}/tasks/{task_id}", status_code=204)
def unassign_task(character_id: int, task_id: int, db: Session = Depends(get_db)):
    assignment = db.get(CharacterTask, (character_id, task_id))
    if assignment is not None:
        db.delete(assignment)
        db.commit()

    return Response(status_code=204)
