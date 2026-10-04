import NewsWidget from "@/components/tracker/NewsWidget";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { GemWidget, GoldGoalWidget, GoldMonthWidget } from "@/components/tracker/Widgets";
import { daysIntoWeek } from "@/lib/insights";
import { NEWS_PREFERENCE } from "@/lib/online";
import { usePreference } from "@/lib/usePreference";
import { WIDGET_KEYS } from "@/lib/trackerView";

/** The optional widgets under the tracker cards. */
export default function WidgetGrid({ data, view }: { data: TrackerData; view: TrackerView }) {
  const [goldGoal, setGoldGoal] = usePreference<number>("gold-goal", 1_000_000);
  // Goes online, so it's off until turned on (Customize or Settings).
  const [newsOn] = usePreference<boolean>(NEWS_PREFERENCE, false);
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
  ].filter((widget) => (widget.key === NEWS_PREFERENCE ? newsOn : view.isShown(widget.key)) && goldWeeks.length > 0);

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
