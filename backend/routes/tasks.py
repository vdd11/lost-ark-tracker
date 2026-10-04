"""Tracker columns: dailies, weeklies and raids."""


from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from database import get_db
from models import Character, CharacterTask, Completion, RaidDifficulty, RaidGroup, Task
from schemas import (
    DifficultyRead,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from routes.common import get_or_404, next_position

router = APIRouter(prefix="/api")


def read_task(db: Session, task: Task) -> TaskRead:
    difficulties = (
        db.query(RaidDifficulty)
        .filter_by(task_id=task.id)
        .order_by(RaidDifficulty.position, RaidDifficulty.id)
    )
    return TaskRead.model_validate(task).model_copy(
        update={"difficulties": [DifficultyRead.model_validate(d) for d in difficulties]}
    )


@router.get("/tasks", response_model=list[TaskRead])
def get_tasks(include_archived: bool = False, db: Session = Depends(get_db)):
    query = db.query(Task)
    if not include_archived:
        query = query.filter(Task.archived.is_(False))
    tasks = query.order_by(Task.position, Task.id).all()

    difficulties_by_task: dict[int, list[DifficultyRead]] = {}
    for d in db.query(RaidDifficulty).order_by(RaidDifficulty.position, RaidDifficulty.id):
        difficulties_by_task.setdefault(d.task_id, []).append(DifficultyRead.model_validate(d))

    return [
        TaskRead.model_validate(t).model_copy(update={"difficulties": difficulties_by_task.get(t.id, [])})
        for t in tasks
    ]


@router.post("/tasks", response_model=TaskRead, status_code=201)
def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**task_data.model_dump(), position=next_position(db, Task))
    db.add(task)
    db.flush()

    # Like new characters, dailies and weeklies apply to everyone by default.
    if task.category != "raid":
        for character in db.query(Character).all():
            db.add(CharacterTask(character_id=character.id, task_id=task.id))

    db.commit()
    db.refresh(task)
    return read_task(db, task)


@router.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, changes: TaskUpdate, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)

    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return read_task(db, task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = get_or_404(db, Task, task_id)

    db.query(CharacterTask).filter(CharacterTask.task_id == task_id).delete()
    if task.catalog_key:
        # Catalog raids come back on every sync, so hide them instead.
        task.archived = True
    else:
        db.query(Completion).filter(Completion.task_id == task_id).update({"task_id": None})
        db.query(RaidGroup).filter(RaidGroup.task_id == task_id).update({"task_id": None})
        db.query(RaidDifficulty).filter(RaidDifficulty.task_id == task_id).delete()
        db.delete(task)
    db.commit()

    return Response(status_code=204)
