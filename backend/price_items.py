"""Built-in items for the Prices table (Tools → Prices).

Only names come from here, never prices: prices are what the user types in
from the in-game market (there's no online price source: lostarkmarket.online,
the community API, now redirects to an unrelated site, checked 2026-10-04).
Users can add their own items, so this list only needs the common ones.

Sources (checked 2026-10-04):
- Tier 4 Upper honing materials and breaths: official "The Shadows Rise"
  release notes, https://www.playlostark.com/en-us/game/releases/the-shadows-rise
  (Destiny Crystallized Destruction/Guardian Stone, Great Leapstone of
  Destiny, Superior Abidos Fusion Material, Lava's Breath, Glacier's Breath).

`per` is how many units the price is for (the market sells some items in
bundles). It defaults to 1; the user sets it to match the listing they copy.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PriceItem:
    key: str
    name: str
    tools: tuple[str, ...]
    per: int = 1


PRICE_ITEMS: list[PriceItem] = [
    PriceItem("destiny-destruction-stone", "Destiny Crystallized Destruction Stone", ("honing",)),
    PriceItem("destiny-guardian-stone", "Destiny Crystallized Guardian Stone", ("honing",)),
    PriceItem("great-leapstone-of-destiny", "Great Leapstone of Destiny", ("honing",)),
    PriceItem("superior-abidos-fusion", "Superior Abidos Fusion Material", ("honing",)),
    PriceItem("lavas-breath", "Lava's Breath", ("honing",)),
    PriceItem("glaciers-breath", "Glacier's Breath", ("honing",)),
]

BY_KEY = {item.key: item for item in PRICE_ITEMS}
CUSTOM_PREFIX = "custom-"
