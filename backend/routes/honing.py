"""Honing plans (Tools → Honing), one per character. The maths runs in the
frontend (lib/honing.ts); this only stores what the user entered."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from database import get_db
from models import Character, HoningPlan
from resets import utc_now
from routes.common import get_or_404
from schemas import HoningPlanRead, HoningPlanSave

router = APIRouter(prefix="/api")


@router.get("/honing-plans", response_model=list[HoningPlanRead])
def get_plans(db: Session = Depends(get_db)):
    return db.query(HoningPlan).order_by(HoningPlan.character_id).all()


@router.put("/honing-plans/{character_id}", response_model=HoningPlanRead)
def save_plan(character_id: int, data: HoningPlanSave, db: Session = Depends(get_db)):
    character = get_or_404(db, Character, character_id)
    plan = db.get(HoningPlan, character_id)
    if plan is None:
        plan = HoningPlan(character_id=character_id, start_item_level=character.item_level)
        db.add(plan)
    elif data.target_item_level != plan.target_item_level:
        # A new goal starts its progress line from where the character is now.
        plan.start_item_level = character.item_level
    plan.target_item_level = data.target_item_level
    plan.notes = (data.notes or "").strip() or None
    plan.plan = data.plan.model_dump()
    plan.bound_mode = data.bound_mode
    plan.updated_at = utc_now()
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/honing-plans/{character_id}", status_code=204)
def delete_plan(character_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, HoningPlan, character_id))
    db.commit()
    return Response(status_code=204)
