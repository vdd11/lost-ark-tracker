import { formatGold, Task } from "./api";
import { boundLabel, formatItemLevel, formatShortGold } from "./raids";

export type RaidInfoRow = { difficulty: string; itemLevel: string; gold: string; gates: string; bound: string; bonus: string };

/** A raid column's details for its header tooltip: one row per difficulty, from the catalog. */
export function raidInfoRows(task: Task): RaidInfoRow[] {
  return [...task.difficulties]
    .sort((a, b) => a.min_item_level - b.min_item_level)
    .map((d) => ({
      difficulty: d.name,
      itemLevel: formatItemLevel(d.min_item_level),
      gold: d.gold === null ? "?" : formatGold(d.gold),
      // Gold per gate, "13k + 19k"; empty for raids without gates.
      gates: task.gate_count ? (d.gate_gold ? d.gate_gold.map(formatShortGold).join(" + ") : "?") : "",
      bound: boundLabel(d.bound_percent, d.bound_kind) || "–",
      bonus: d.bonus_cost === null ? "?" : formatGold(d.bonus_cost),
    }));
}
