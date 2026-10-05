/** "This week / Last 4 weeks / All time" for the tracker's gold and gem widgets. */
export type Period = "week" | "month" | "all";

export const PERIODS: { key: Period; label: string; short: string }[] = [
  { key: "week", label: "This week", short: "Week" },
  { key: "month", label: "Last 4 weeks", short: "4 wk" },
  { key: "all", label: "All time", short: "All" },
];
export const PERIOD_KEYS = PERIODS.map((p) => p.key as string);

/** The weeks a period covers, oldest first; weeks before anything was tracked don't count. */
export function weeksIn<T>(weeks: T[], period: Period, isEmpty: (week: T) => boolean): T[] {
  if (period === "week") return weeks.slice(-1);
  if (period === "month") return weeks.slice(-4);
  const first = weeks.findIndex((w) => !isEmpty(w));
  return first === -1 ? weeks.slice(-1) : weeks.slice(first);
}

/** A period's total and its weekly average (over the weeks it covers). */
export function periodTotal<T>(weeks: T[], period: Period, value: (week: T) => number) {
  const covered = weeksIn(weeks, period, (w) => value(w) === 0);
  const total = covered.reduce((sum, w) => sum + value(w), 0);
  return { total, weeks: covered.length, perWeek: covered.length ? total / covered.length : 0 };
}
