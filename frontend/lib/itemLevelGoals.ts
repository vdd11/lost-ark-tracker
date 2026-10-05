import { Character, Difficulty, Task } from "./api";
import { formatItemLevel, isActiveRaid } from "./raids";

export type NextUnlock = { task: Task; difficulty: Difficulty; gap: number };

/**
 * The nearest difficulty a character can't enter yet, across everything with
 * tiers (raids still running, Haal's Hourglass levels, Ebony Cube unlocks).
 * Ties go to the one paying the most gold. Item levels are the difficulties'
 * own (the built-in catalog, or an event raid's).
 */
export function nextUnlock(character: Character, tasks: Task[], today = new Date()): NextUnlock | null {
  const candidates = tasks
    .filter((task) => !task.archived && task.difficulties.length > 0 && (task.category !== "raid" || isActiveRaid(task, today)))
    .flatMap((task) => task.difficulties.filter((d) => d.min_item_level > character.item_level).map((difficulty) => ({ task, difficulty })))
    .sort(
      (a, b) =>
        a.difficulty.min_item_level - b.difficulty.min_item_level || (b.difficulty.gold ?? 0) - (a.difficulty.gold ?? 0),
    );
  const best = candidates[0];
  if (!best) return null;
  // Rounded so float noise (1730 - 1725.83) shows as +4.17, not +4.170000000000073.
  return { ...best, gap: Math.round((best.difficulty.min_item_level - character.item_level) * 100) / 100 };
}

/** "+4", "+4.2", "+0.83". */
export function formatGap(gap: number) {
  return `+${formatItemLevel(gap)}`;
}
