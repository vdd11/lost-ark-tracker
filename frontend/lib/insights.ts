/** Projections for the tracker's widgets. Pure, so they're easy to test. */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Average per day over recent weeks. `values` are weekly totals, oldest
 * first, with the current (partial) week last. Uses up to `lookback`
 * finished weeks plus the days so far this week, skipping weeks before
 * anything was tracked so a new user's rate isn't dragged down by zeros.
 * Null until there's at least a day of data.
 */
export function dailyRate(values: number[], daysIntoWeek: number, lookback = 4): number | null {
  const window = values.slice(-(lookback + 1));
  const first = window.findIndex((v) => v > 0);
  if (first === -1) return null;
  const used = window.slice(first);
  const days = (used.length - 1) * 7 + Math.min(7, Math.max(0, daysIntoWeek));
  if (days < 1) return null;
  return used.reduce((sum, v) => sum + v, 0) / days;
}

/** Days from a week's 10:00 UTC Wednesday reset to now. */
export function daysIntoWeek(weekStart: string, now = new Date()) {
  return (now.getTime() - new Date(`${weekStart}T10:00:00Z`).getTime()) / DAY;
}

export type GemGoal = {
  level: number;
  /** Level-1 equivalents one gem of this level is worth. */
  size: number;
  /** Progress toward the next one, 0-1. */
  progress: number;
  /** Already earned enough for this many. */
  earned: number;
  /** Days until the next one at the current pace, or null without a pace. */
  days: number | null;
  /** Days each one takes at the current pace. */
  every: number | null;
};

/** How tracked gems add up toward a gem of `level` (three of a level make the next). */
export function gemGoal(totalLv1: number, perDay: number | null, level: number): GemGoal {
  const size = 3 ** (level - 1);
  const earned = Math.floor(totalLv1 / size + 1e-9);
  const progress = (totalLv1 - earned * size) / size;
  const pace = perDay && perDay > 0 ? perDay : null;
  return {
    level,
    size,
    progress,
    earned,
    days: pace ? (size - (totalLv1 - earned * size)) / pace : null,
    every: pace ? size / pace : null,
  };
}

/** Days to go from `current` to `goal` at `perDay`; 0 if already there, null without a pace. */
export function daysToGoal(current: number, goal: number, perDay: number | null) {
  if (current >= goal) return 0;
  if (!perDay || perDay <= 0) return null;
  return (goal - current) / perDay;
}

/** Percent change from one period to the next, or null when there's nothing to compare. */
export function percentChange(previous: number, current: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "3 days", "5 weeks", "4 months", "1.5 years". */
export function formatDuration(days: number) {
  if (days < 1) return "under a day";
  if (days < 14) return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  if (days < 61) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30.4)} months`;
  const years = Math.round((days / 365) * 10) / 10;
  return `${years} year${years === 1 ? "" : "s"}`;
}

/** The calendar date `days` from now, e.g. "Mar 12" (with the year when it isn't this one). */
export function formatEta(days: number, now = new Date()) {
  const date = new Date(now.getTime() + days * DAY);
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Compact gold: 812,500 -> "812.5k", 1,250,000 -> "1.25M". */
export function compactGold(gold: number) {
  const abs = Math.abs(gold);
  if (abs >= 1_000_000) return `${Math.round(gold / 10_000) / 100}M`;
  if (abs >= 1000) return `${Math.round(gold / 100) / 10}k`;
  return String(Math.round(gold));
}
