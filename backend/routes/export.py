"""Full history as CSV, for spreadsheets."""

import csv
import io

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from accounts import account_owner
from database import get_db
from gems import lv1_equivalent
from models import Account, Character, Completion, GemEntry, GoldEntry, Task
from resets import week_of

router = APIRouter(prefix="/api")


def number(value: float) -> int | float:
    """44.0 -> 44, keep averages like 0.5 as they are."""
    return int(value) if float(value).is_integer() else round(value, 3)


def csv_response(filename: str, header: list[str], rows: list[list]) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(sorted(rows, key=lambda row: row[0]))
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def account_names(db: Session):
    """Name of the account gold or gems belong to (see accounts.account_owner)."""
    owner = account_owner(db)
    names = dict(db.query(Account.id, Account.name).all())
    return lambda character_id=None, account_id=None: names.get(owner(character_id, account_id), "")


@router.get("/export/gold.csv")
def export_gold(db: Session = Depends(get_db)):
    names = dict(db.query(Character.id, Character.name).all())
    account = account_names(db)
    rows = []
    clears = (
        db.query(Completion, Task.name)
        .outerjoin(Task, Task.id == Completion.task_id)
        .filter((Completion.gold > 0) | (Completion.bonus_spent > 0))
    )
    for completion, task_name in clears:
        rows.append([
            completion.completed_at.isoformat(timespec="minutes"), week_of(completion.completed_at).isoformat(),
            "raid", task_name or "", names.get(completion.character_id, ""), completion.gold,
            completion.bound_gold - completion.character_bound_gold, completion.character_bound_gold,
            completion.bonus_spent, "", account(completion.character_id),
        ])
    for entry in db.query(GoldEntry):
        rows.append([
            entry.earned_at.isoformat(timespec="minutes"), week_of(entry.earned_at).isoformat(),
            "logged", entry.source, names.get(entry.character_id, ""), entry.amount, 0, 0, 0, entry.note or "",
            account(entry.character_id, entry.account_id),
        ])
    header = [
        "time_utc", "week", "kind", "source", "character", "gold",
        "roster_bound_gold", "character_bound_gold", "bonus_spent", "note", "account",
    ]
    return csv_response("lost-ark-gold.csv", header, rows)


@router.get("/export/gems.csv")
def export_gems(db: Session = Depends(get_db)):
    names = dict(db.query(Character.id, Character.name).all())
    account = account_names(db)
    rows = []

    def add(moment, kind, source, character_id, gems, note=""):
        for level, count in sorted(gems.items(), key=lambda item: int(item[0])):
            rows.append([
                moment.isoformat(timespec="minutes"), week_of(moment).isoformat(), kind, source,
                names.get(character_id, ""), int(level), number(count), number(lv1_equivalent(int(level), count)), note,
                account(character_id),
            ])

    tracked = (
        db.query(Completion, Task.name)
        .outerjoin(Task, Task.id == Completion.task_id)
        .filter(Completion.gems.is_not(None))
    )
    for completion, task_name in tracked:
        if completion.gems:
            add(completion.completed_at, "tracked", task_name or "", completion.character_id, completion.gems)
    for entry in db.query(GemEntry):
        add(entry.earned_at, "logged", entry.source, entry.character_id, entry.gems, entry.note or "")

    header = [
        "time_utc", "week", "kind", "source", "character", "gem_level", "count", "lv1_equivalent", "note", "account",
    ]
    return csv_response("lost-ark-gems.csv", header, rows)
