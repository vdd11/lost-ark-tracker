"""The Guides page's user data: links the user added, and built-in links they
hid. The built-in list itself lives in the frontend (lib/data/guides.json);
nothing here goes online."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import GuideLink, HiddenGuide
from routes.common import get_or_404
from schemas import GuideLinkCreate, GuideLinkRead, GuideLinkUpdate, GuidesRead

router = APIRouter(prefix="/api")


@router.get("/guides", response_model=GuidesRead)
def get_guides(db: Session = Depends(get_db)):
    links = db.query(GuideLink).order_by(GuideLink.position, GuideLink.id).all()
    hidden = [row.guide_id for row in db.query(HiddenGuide).order_by(HiddenGuide.guide_id)]
    return GuidesRead(links=links, hidden=hidden)


@router.post("/guides/links", response_model=GuideLinkRead, status_code=201)
def create_link(data: GuideLinkCreate, db: Session = Depends(get_db)):
    last = db.query(func.max(GuideLink.position)).scalar()
    link = GuideLink(**data.model_dump(), position=(last or 0) + 1)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.patch("/guides/links/{link_id}", response_model=GuideLinkRead)
def update_link(link_id: int, data: GuideLinkUpdate, db: Session = Depends(get_db)):
    link = get_or_404(db, GuideLink, link_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None or field == "description":
            setattr(link, field, value)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/guides/links/{link_id}", status_code=204)
def delete_link(link_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, GuideLink, link_id))
    db.commit()
    return Response(status_code=204)


@router.put("/guides/hidden/{guide_id}", status_code=204)
def hide_guide(guide_id: str, db: Session = Depends(get_db)):
    if db.get(HiddenGuide, guide_id[:80]) is None:
        db.add(HiddenGuide(guide_id=guide_id[:80]))
        db.commit()
    return Response(status_code=204)


@router.delete("/guides/hidden/{guide_id}", status_code=204)
def show_guide(guide_id: str, db: Session = Depends(get_db)):
    db.query(HiddenGuide).filter(HiddenGuide.guide_id == guide_id).delete()
    db.commit()
    return Response(status_code=204)


@router.delete("/guides/hidden", status_code=204)
def show_all_guides(db: Session = Depends(get_db)):
    """Reset hidden: every built-in link shows again."""
    db.query(HiddenGuide).delete()
    db.commit()
    return Response(status_code=204)
