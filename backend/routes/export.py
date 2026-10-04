"""Full history as CSV, for spreadsheets."""

import csv
import io

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from accounts import account_owner
from database import get_db
from gems import lv1_equivalent
from models import Account, Character, Completion, GemEntry, GoldEntry, HoningPlan, MarketPrice, SpendingEntry, Task
from price_items import PRICE_ITEMS
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


@router.get("/export/prices.csv")
def export_prices(db: Session = Depends(get_db)):
    from routes.prices import all_prices

    rows = [
        [
            p.name, "" if p.price is None else number(p.price), p.per,
            "" if p.unit_price is None else number(p.unit_price),
            p.updated_at.isoformat(timespec="minutes") if p.updated_at else "", "built-in" if p.builtin else "custom",
        ]
        for p in all_prices(db)
    ]
    return csv_response("lost-ark-prices.csv", ["item", "price", "per", "gold_per_unit", "updated", "kind"], rows)


@router.get("/export/spending.csv")
def export_spending(db: Session = Depends(get_db)):
    names = dict(db.query(Character.id, Character.name).all())
    account = account_names(db)
    rows = [
        [
            entry.spent_at.isoformat(timespec="minutes"), week_of(entry.spent_at).isoformat(), entry.category,
            entry.amount, entry.paid_from, names.get(entry.character_id, ""), entry.note or "",
            account(entry.character_id, entry.account_id),
        ]
        for entry in db.query(SpendingEntry)
    ]
    header = ["time", "week", "category", "amount", "paid_from", "character", "note", "account"]
    return csv_response("lost-ark-spending.csv", header, rows)


@router.get("/export/honing-plans.csv")
def export_honing_plans(db: Session = Depends(get_db)):
    """One row per upgrade step, with the plan's goal on each row."""
    names = dict(db.query(Character.id, Character.name).all())
    item_names = {item.key: item.name for item in PRICE_ITEMS}
    item_names.update({row.key: row.name for row in db.query(MarketPrice) if row.name})
    rows = []
    for plan in db.query(HoningPlan):
        for step in plan.plan.get("steps", []):
            materials = "; ".join(
                f"{item_names.get(key, key)} x{number(amount)}" for key, amount in step.get("materials", {}).items() if amount
            )
            rows.append([
                names.get(plan.character_id, ""), number(plan.start_item_level),
                "" if plan.target_item_level is None else number(plan.target_item_level), step.get("label", ""),
                step.get("count", 0), number(step.get("chance", 0)), number(step.get("chanceStep", 0)),
                "" if step.get("chanceCap") is None else number(step["chanceCap"]), step.get("guaranteedBy") or "",
                number(step.get("gold", 0)), number(step.get("silver", 0)), materials, plan.notes or "",
            ])
    header = [
        "character", "start_item_level", "target_item_level", "step", "times", "chance_percent", "chance_per_fail",
        "max_chance", "guaranteed_by", "gold_per_try", "silver_per_try", "materials_per_try", "notes",
    ]
    return csv_response("lost-ark-honing-plans.csv", header, rows)
