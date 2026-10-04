/** The weekly history grid's cells: how a character's week went. */

export type CharacterWeek = { week: string; raids: number; paid_raids: number; gold: number };
export type WeeklyHistory = { weeks: string[]; characters: Record<string, CharacterWeek[]> };

export type CellTone = "full" | "partial" | "missed" | "none" | "untracked";

/**
 * The first week with anything recorded for a character (a clear or gold);
 * earlier weeks predate tracking them, so they aren't "missed". -1 if none.
 */
export function firstTrackedWeek(weeks: (CharacterWeek | undefined)[]) {
  return weeks.findIndex((week) => Boolean(week && (week.raids > 0 || week.gold !== 0)));
}

/**
 * A gold earner's week against their paid slots (up to 3, from the raids
 * they can enter now): all done, some, or none. Non-earners and characters
 * with no slots just show what they cleared.
 */
export function weekTone(week: CharacterWeek | undefined, slots: number, isGoldEarner: boolean): CellTone {
  if (!isGoldEarner || slots === 0) return "none";
  const paid = Math.min(week?.paid_raids ?? 0, slots);
  if (paid >= slots) return "full";
  return paid > 0 ? "partial" : "missed";
}

/**
 * Gold raids left on the table across finished weeks since tracking started
 * (the current week isn't over, and weeks before tracking don't count).
 */
export function missedRaids(weeks: (CharacterWeek | undefined)[], slots: number, isGoldEarner: boolean) {
  const first = firstTrackedWeek(weeks);
  if (!isGoldEarner || first === -1) return 0;
  return weeks
    .slice(first, -1)
    .reduce((sum, week) => sum + Math.max(0, slots - Math.min(week?.paid_raids ?? 0, slots)), 0);
}
