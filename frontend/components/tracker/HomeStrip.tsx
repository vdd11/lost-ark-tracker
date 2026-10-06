"use client";

import GameIcon from "@/components/GameIcon";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { parseUtc } from "@/lib/api";
import { homeNudges } from "@/lib/homeStrip";
import { goldRaidsLeft } from "@/lib/raids";
import { formatCountdown } from "@/lib/trackerSections";

/**
 * One slim line at the top of the tracker: the next resets, gold raids left,
 * and short reminders (full rest gauges, Hourglass runs left, Field Boss /
 * Chaos Gate days). Always one line high, so it never moves the page: on a
 * narrow screen it scrolls sideways instead of wrapping.
 */
export default function HomeStrip({ data, fieldEvents }: { data: TrackerData; fieldEvents: boolean }) {
  const { tracker, now } = data;
  if (!tracker) return null;
  const raidsLeft = goldRaidsLeft(data.characters, data.tasks, data.runs).left;
  const nudges = homeNudges({
    characters: data.characters,
    tasks: data.tasks,
    rests: tracker.rest,
    runs: data.runs,
    dailyPeriod: tracker.daily_period,
    fieldEvents,
  });
  const item = "flex shrink-0 items-center gap-1.5 whitespace-nowrap";

  return (
    <div
      role="status"
      aria-label="Today at a glance"
      className="flex h-11 items-center gap-5 overflow-x-auto rounded-lg border border-border bg-surface px-3 text-sm [scrollbar-width:none]"
    >
      <span className={item} title="Next resets (10:00 UTC; weekly on Wednesday)">
        <GameIcon name="resets" size={22} alt="" />
        Daily in {formatCountdown(parseUtc(tracker.next_daily_reset), now)}
        <span className="text-muted">· weekly in {formatCountdown(parseUtc(tracker.next_weekly_reset), now)}</span>
      </span>
      <span className={item}>
        <GameIcon name="gold-raids" size={22} alt="" />
        <span className={raidsLeft > 0 ? "font-medium text-accent" : "text-muted"}>
          {raidsLeft > 0 ? `${raidsLeft} gold raid${raidsLeft === 1 ? "" : "s"} left` : "Gold raids done"}
        </span>
      </span>
      {nudges.map((nudge) => (
        <span key={nudge.key} className={item} title={nudge.title}>
          <GameIcon name={nudge.icon} size={22} alt="" />
          {nudge.text}
        </span>
      ))}
    </div>
  );
}
