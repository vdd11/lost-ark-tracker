import CountersWidget from "@/components/tracker/CountersWidget";
import NewsWidget from "@/components/tracker/NewsWidget";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { GemWidget, GoldGoalWidget, GoldMonthWidget, ResetClockWidget } from "@/components/tracker/Widgets";
import { daysIntoWeek } from "@/lib/insights";
import { COUNTERS_PREFERENCE } from "@/lib/counters";
import { NEWS_PREFERENCE } from "@/lib/online";
import { RESET_CLOCK_PREFERENCE } from "@/lib/resetClock";
import { usePreference } from "@/lib/usePreference";
import { WIDGET_KEYS } from "@/lib/trackerView";

/** The optional widgets under the tracker cards. */
export default function WidgetGrid({ data, view }: { data: TrackerData; view: TrackerView }) {
  const [goldGoal, setGoldGoal] = usePreference<number>("gold-goal", 1_000_000);
  // Goes online, so it's off until turned on (Customize or Settings).
  const [newsOn] = usePreference<boolean>(NEWS_PREFERENCE, false);
  const [resetClockOn] = usePreference<boolean>(RESET_CLOCK_PREFERENCE, false);
  const [countersOn] = usePreference<boolean>(COUNTERS_PREFERENCE, false);
  const { goldWeeks, gemWeeks, tracker, now } = data;
  const weekDays = tracker ? daysIntoWeek(tracker.weekly_period, now) : 0;

  const widgets = [
    { key: WIDGET_KEYS.goldMonth, node: <GoldMonthWidget weeks={goldWeeks} /> },
    {
      key: WIDGET_KEYS.goldGoal,
      node: <GoldGoalWidget weeks={goldWeeks} daysIntoWeek={weekDays} balance={data.balance} goal={goldGoal} onGoal={setGoldGoal} />,
    },
    { key: WIDGET_KEYS.gems, node: <GemWidget weeks={gemWeeks} daysIntoWeek={weekDays} /> },
    { key: NEWS_PREFERENCE, node: <NewsWidget /> },
    {
      key: COUNTERS_PREFERENCE,
      node: <CountersWidget characters={data.characters} accountId={data.accountId} onError={data.setError} />,
    },
    {
      key: RESET_CLOCK_PREFERENCE,
      node: tracker ? <ResetClockWidget nextDaily={tracker.next_daily_reset} nextWeekly={tracker.next_weekly_reset} now={now} /> : null,
    },
  ].filter((widget) => {
    // Opt-in widgets have their own switch; the rest follow Customize and need some gold history.
    if (widget.key === NEWS_PREFERENCE) return newsOn;
    if (widget.key === RESET_CLOCK_PREFERENCE) return resetClockOn && widget.node !== null;
    if (widget.key === COUNTERS_PREFERENCE) return countersOn;
    return view.isShown(widget.key) && goldWeeks.length > 0;
  });

  if (widgets.length === 0) return null;
  return (
    <div className={`grid gap-4 md:grid-cols-2 ${widgets.length === 3 ? "xl:grid-cols-3" : ""}`}>
      {widgets.map((widget) => (
        <div key={widget.key} className="flex [&>*]:flex-1">
          {widget.node}
        </div>
      ))}
    </div>
  );
}
