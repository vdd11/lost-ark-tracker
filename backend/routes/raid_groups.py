"""Raid groups (statics): which raid, when, and who's in it. Local only."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import RaidGroup, Task
from routes.common import get_or_404
from schemas import RaidGroupCreate, RaidGroupRead, RaidGroupUpdate

router = APIRouter(prefix="/api")


@router.get("/raid-groups", response_model=list[RaidGroupRead])
def get_groups(db: Session = Depends(get_db)):
    return db.query(RaidGroup).order_by(RaidGroup.position, RaidGroup.id).all()


@router.post("/raid-groups", response_model=RaidGroupRead, status_code=201)
def create_group(data: RaidGroupCreate, db: Session = Depends(get_db)):
    if data.task_id is not None:
        get_or_404(db, Task, data.task_id)
    last = db.query(func.max(RaidGroup.position)).scalar()
    group = RaidGroup(**{**data.model_dump(), "name": data.name.strip()}, position=(last or 0) + 1)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.patch("/raid-groups/{group_id}", response_model=RaidGroupRead)
def update_group(group_id: int, data: RaidGroupUpdate, db: Session = Depends(get_db)):
    group = get_or_404(db, RaidGroup, group_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("task_id") is not None:
        get_or_404(db, Task, changes["task_id"])
    for field, value in changes.items():
        if field in ("name", "members", "position") and value is None:
            continue
        setattr(group, field, value.strip() if field == "name" else value)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/raid-groups/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, RaidGroup, group_id))
    db.commit()
    return Response(status_code=204)
