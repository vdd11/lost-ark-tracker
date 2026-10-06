import { CatalogReference, formatGold } from "./api";
import { boundLabel, formatItemLevel } from "./raids";

/** The raid values this browser last saw, keyed "Raid · Difficulty". */
export type CatalogSnapshot = Record<string, { itemLevel: number; gold: number | null; bound: string; bonusCost: number | null }>;

export const CATALOG_SEEN_PREFERENCE = "raid-catalog-seen";

export function snapshotOf(reference: CatalogReference): CatalogSnapshot {
  const snapshot: CatalogSnapshot = {};
  for (const raid of reference.raids) {
    for (const d of raid.difficulties) {
      snapshot[`${raid.name} · ${d.name}`] = {
        itemLevel: d.item_level,
        gold: d.gold,
        bound: boundLabel(d.bound_percent, d.bound_kind),
        bonusCost: d.bonus_cost,
      };
    }
  }
  return snapshot;
}

export function parseSnapshot(raw: string): CatalogSnapshot | null {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as CatalogSnapshot) : null;
  } catch {
    return null;
  }
}

const gold = (value: number | null) => (value === null ? "?" : formatGold(value));

/** One line per change between two snapshots, in the order the raids are listed. */
export function catalogChanges(before: CatalogSnapshot, after: CatalogSnapshot): string[] {
  const lines: string[] = [];
  for (const [key, now] of Object.entries(after)) {
    const was = before[key];
    if (!was) {
      lines.push(`New: ${key} (${formatItemLevel(now.itemLevel)}, ${gold(now.gold)} gold)`);
      continue;
    }
    const parts: string[] = [];
    if (was.itemLevel !== now.itemLevel) parts.push(`item level ${formatItemLevel(was.itemLevel)} → ${formatItemLevel(now.itemLevel)}`);
    if (was.gold !== now.gold) parts.push(`gold ${gold(was.gold)} → ${gold(now.gold)}`);
    if (was.bound !== now.bound) parts.push(`bound ${was.bound || "none"} → ${now.bound || "none"}`);
    if (was.bonusCost !== now.bonusCost) parts.push(`bonus boxes ${gold(was.bonusCost)} → ${gold(now.bonusCost)}`);
    if (parts.length) lines.push(`${key}: ${parts.join(", ")}`);
  }
  for (const key of Object.keys(before)) {
    if (!(key in after)) lines.push(`Removed: ${key}`);
  }
  return lines;
}
