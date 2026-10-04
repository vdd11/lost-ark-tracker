"""Weekly history per character, for the Gold page's history grid."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from history import weekly_history
from schemas import CharacterWeek, WeeklyHistory

router = APIRouter(prefix="/api")


@router.get("/history/weekly", response_model=WeeklyHistory)
def get_weekly_history(weeks: int = Query(default=8, ge=1, le=52), db: Session = Depends(get_db)):
    week_starts, by_character = weekly_history(db, weeks)
    return WeeklyHistory(
        weeks=week_starts,
        characters={
            character_id: [CharacterWeek(week=week, **cells[week]) for week in week_starts]
            for character_id, cells in by_character.items()
        },
    )
