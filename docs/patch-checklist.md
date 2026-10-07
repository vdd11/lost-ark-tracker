# After each Lost Ark patch

Raid values are the app's, not the user's: whatever `backend/raids.py` says
reaches every user on their next launch (`sync_catalog` overwrites them; a
`None` keeps what's there). So after a patch, check these against the
official NA release notes on playlostark.com, or numbers the maintainer gives
you. Never fill a gap from memory or a guess: leave it `None` (the app shows
"?").

## `backend/raids.py`

- [ ] **New raid or difficulty**: add a `CatalogTask` / `Difficulty` with
      item level, gold (total for all gates), bound share
      (`bound_percent` + `bound_kind`) and bonus box cost (sum of every gate's
      "View More" chest), plus `gates` on the raid and `gate_gold` /
      `gate_bonus` per difficulty (they must add up to `gold` / `bonus_cost`;
      a test checks). Unknown values are `None`.
- [ ] **Changed values**: item level, gold, bound split, bonus costs, and the
      per-gate splits. Note where they came from.
- [ ] **Renamed raid**: change `name` and add the old one to `legacy_names`
      so existing columns are adopted.
- [ ] **Removed difficulty**: drop it from the list; characters on it move to
      their best remaining one.
- [ ] **Retired raid**: remove it from `CATALOG` (it becomes a plain custom
      raid, history intact).
- [ ] **Extreme events**: `EXTREME_TEMPLATE` (default difficulties) and
      `EXTREME_BASES` if a new raid can get an Extreme mode.
- [ ] **Gold rules**: `GOLD_RAIDS_PER_WEEK`, `MAX_GOLD_EARNERS`,
      `FREE_BONUS_RAIDS_PER_WEEK`, and the bound-gold spending order.
- [ ] Update the module docstring's sources and bump **`CATALOG_REVIEWED`**
      (shown in Settings → Raids as "Raid data last reviewed").

## Gem tables

- [ ] Ebony Cube unlocks and Haal's Hourglass levels in `raids.py`
      (`reward_gems`, `lucky_gems`, `mega_gems`; expected gems per run by
      level; a lucky room's table is per tier). Users can only fill in a
      table that's `None`, and a value here replaces theirs on update.
- [ ] Astrogem odds in `frontend/lib/data/astrogems.ts` (official KR
      probability page, NA release notes).

## Then

- [ ] `cd backend && .venv/Scripts/python -m pytest -q` (catalog tests pin a
      few values; update them with the new numbers).
- [ ] Start the app on a copy of an old database (`--data-dir`) and check the
      tracker and Settings → Raids → Raid reference.
- [ ] Mention the changed values in the release notes.
