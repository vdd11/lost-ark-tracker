import { WeeklyGold } from "./api";

export type SourceRow = { source: string; thisWeek: number; lastFour: number; average: number };

export const RAIDS_SOURCE = "Raids";

/**
 * Gold per source: raids plus each logged source ("Chaos Gate", ...), for
 * this week, the last four finished weeks together, and the weekly average
 * over the finished weeks shown. Richest first; sources with nothing left out.
 */
export function goldBySource(weeks: WeeklyGold[]): SourceRow[] {
  if (!weeks.length) return [];
  const amounts = (week: WeeklyGold): Record<string, number> => ({ [RAIDS_SOURCE]: week.raid_gold, ...week.by_source });
  const current = amounts(weeks[weeks.length - 1]);
  const finished = weeks.slice(0, -1).map(amounts);
  const lastFour = finished.slice(-4);
  const sources = new Set([...Object.keys(current), ...finished.flatMap((w) => Object.keys(w))]);
  const sum = (list: Record<string, number>[], source: string) => list.reduce((total, w) => total + (w[source] ?? 0), 0);

  return [...sources]
    .map((source) => ({
      source,
      thisWeek: current[source] ?? 0,
      lastFour: sum(lastFour, source),
      average: finished.length ? sum(finished, source) / finished.length : 0,
    }))
    .filter((row) => row.thisWeek || row.lastFour || row.average)
    .sort((a, b) => b.average - a.average || b.thisWeek - a.thisWeek || a.source.localeCompare(b.source));
}
