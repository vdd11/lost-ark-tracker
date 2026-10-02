"use client";

import StackedWeeklyChart, { ChartSeries } from "@/components/StackedWeeklyChart";
import { WeeklyGold } from "@/lib/api";

const SERIES = [
  { key: "raid_gold", label: "Raid gold", color: "var(--series-1)" },
  { key: "other_gold", label: "Other gold", color: "var(--series-2)" },
] as const satisfies readonly ChartSeries[];

export type SeriesKey = (typeof SERIES)[number]["key"];

export default function WeeklyGoldChart({ weeks, show }: { weeks: WeeklyGold[]; show: SeriesKey[] }) {
  const series = SERIES.filter((s) => show.includes(s.key));
  const onlyOther = series.length === 1 && series[0].key === "other_gold";

  return (
    <StackedWeeklyChart
      label="Weekly gold"
      series={series}
      weeks={weeks.map((week) => ({
        week: week.week,
        values: { raid_gold: week.raid_gold, other_gold: week.other_gold },
        details: onlyOther ? Object.entries(week.by_source) : undefined,
      }))}
    />
  );
}
