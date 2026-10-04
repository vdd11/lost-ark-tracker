"""Market prices the user types in (Tools → Prices). Offline only: nothing
here goes online (see price_items.py for why)."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database import get_db
from models import MarketPrice
from price_items import BY_KEY, CUSTOM_PREFIX, PRICE_ITEMS
from resets import utc_now
from schemas import PriceCreate, PriceRead, PriceUpdate

router = APIRouter(prefix="/api")


def read(key: str, row: MarketPrice | None) -> PriceRead:
    item = BY_KEY.get(key)
    price = row.price if row else None
    per = row.per if row else (item.per if item else 1)
    return PriceRead(
        key=key,
        name=(item.name if item else None) or (row.name if row else None) or key,
        price=price,
        per=per,
        unit_price=None if price is None else price / per,
        hidden=bool(row and row.hidden),
        builtin=item is not None,
        tools=list(item.tools) if item else [],
        updated_at=row.updated_at if row else None,
    )


def all_prices(db: Session) -> list[PriceRead]:
    rows = {row.key: row for row in db.query(MarketPrice)}
    builtin = [read(item.key, rows.get(item.key)) for item in PRICE_ITEMS]
    custom = [read(key, row) for key, row in sorted(rows.items()) if key not in BY_KEY]
    return builtin + custom


@router.get("/prices", response_model=list[PriceRead])
def get_prices(db: Session = Depends(get_db)):
    return all_prices(db)


@router.post("/prices", response_model=PriceRead, status_code=201)
def create_price(data: PriceCreate, db: Session = Depends(get_db)):
    taken = {key for (key,) in db.query(MarketPrice.key).filter(MarketPrice.key.startswith(CUSTOM_PREFIX))}
    number = 1
    while f"{CUSTOM_PREFIX}{number}" in taken:
        number += 1
    row = MarketPrice(
        key=f"{CUSTOM_PREFIX}{number}",
        name=data.name.strip(),
        price=data.price,
        per=data.per,
        updated_at=utc_now() if data.price is not None else None,
    )
    db.add(row)
    db.commit()
    return read(row.key, row)


@router.patch("/prices/{key}", response_model=PriceRead)
def update_price(key: str, data: PriceUpdate, db: Session = Depends(get_db)):
    row = db.get(MarketPrice, key)
    if row is None:
        if key not in BY_KEY:
            raise HTTPException(status_code=404, detail="No such item")
        row = MarketPrice(key=key, per=BY_KEY[key].per)
        db.add(row)
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes:
        if key in BY_KEY:
            raise HTTPException(status_code=400, detail="Built-in items keep their name")
        row.name = changes["name"].strip()
    if "price" in changes:
        row.price = changes["price"]
        row.updated_at = utc_now()
    if changes.get("per") is not None:
        row.per = changes["per"]
    if changes.get("hidden") is not None:
        row.hidden = changes["hidden"]
    db.commit()
    return read(key, row)


@router.delete("/prices/{key}", status_code=204)
def delete_price(key: str, db: Session = Depends(get_db)):
    """Custom items are removed; built-in ones go back to no price, shown."""
    row = db.get(MarketPrice, key)
    if row is None and key not in BY_KEY:
        raise HTTPException(status_code=404, detail="No such item")
    if row is not None:
        db.delete(row)
        db.commit()
    return Response(status_code=204)
