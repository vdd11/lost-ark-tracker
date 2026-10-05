import { useEffect, useState } from "react";

import CountersWidget from "@/components/tracker/CountersWidget";
import NewsWidget from "@/components/tracker/NewsWidget";
import RaidGroupsWidget from "@/components/tracker/RaidGroupsWidget";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { ArrangeableList, useSavedOrder, WIDGET_ORDER_PREFERENCE } from "@/components/tracker/arrange";
import { AuctionWidget, GemWidget, GoldGoalWidget, GoldMonthWidget, ResetClockWidget } from "@/components/tracker/Widgets";
import { api, WeeklyGold } from "@/lib/api";
import { COUNTERS_PREFERENCE } from "@/lib/counters";
import { GOAL_MODES, GoalMode } from "@/lib/goldGoal";
import { daysIntoWeek } from "@/lib/insights";
import { mergeOrder } from "@/lib/order";
import { Period, PERIOD_KEYS } from "@/lib/periods";
import { NEWS_PREFERENCE } from "@/lib/online";
import { RAID_GROUPS_PREFERENCE } from "@/lib/raidGroups";
import { isActiveRaid } from "@/lib/raids";
import { RESET_CLOCK_PREFERENCE } from "@/lib/resetClock";
import { usePreference } from "@/lib/usePreference";
import { cellKey } from "@/lib/trackerSections";
import { WIDGET_KEYS } from "@/lib/trackerView";

const GOAL_MODE_KEYS = GOAL_MODES.map((m) => m.key as string);

/** Every widget, in the default order, and the names shown while arranging. */
const ALL_WIDGETS = [
  WIDGET_KEYS.goldMonth,
  WIDGET_KEYS.goldGoal,
  WIDGET_KEYS.auction,
  WIDGET_KEYS.gems,
  NEWS_PREFERENCE,
  COUNTERS_PREFERENCE,
  RAID_GROUPS_PREFERENCE,
  RESET_CLOCK_PREFERENCE,
];
const WIDGET_LABELS: Record<string, string> = {
  [WIDGET_KEYS.goldMonth]: "Gold",
  [WIDGET_KEYS.goldGoal]: "Gold goal",
  [WIDGET_KEYS.auction]: "Auction calculator",
  [WIDGET_KEYS.gems]: "Gem progress",
  [NEWS_PREFERENCE]: "Lost Ark updates",
  [COUNTERS_PREFERENCE]: "Counters",
  [RAID_GROUPS_PREFERENCE]: "Raid groups",
  [RESET_CLOCK_PREFERENCE]: "Resets",
};

/** The optional widgets under the tracker cards. */
export default function WidgetGrid({ data, view, arranging = false }: { data: TrackerData; view: TrackerView; arranging?: boolean }) {
  // Each mode keeps its own target; the default mode keeps the original preference.
  const [goalMode, setGoalMode] = usePreference<string>("gold-goal-mode", "roster", GOAL_MODE_KEYS);
  const mode = goalMode as GoalMode;
  const [goldGoal, setGoldGoal] = usePreference<number>(mode === "roster" ? "gold-goal" : `gold-goal-${mode}`, 1_000_000);
  const [order, setOrder] = useSavedOrder(WIDGET_ORDER_PREFERENCE, ALL_WIDGETS);
  const [goalCharacter, setGoalCharacter] = usePreference<number>("gold-goal-character", 0);
  const [goldPeriod, setGoldPeriod] = usePreference<string>("gold-widget-period", "month", PERIOD_KEYS);
  const [gemPeriod, setGemPeriod] = usePreference<string>("gem-widget-period", "all", PERIOD_KEYS);
  // "All time" gold needs more than the tracker's 9 weeks; load it only when asked for.
  const [allGold, setAllGold] = useState<{ key: string; weeks: WeeklyGold[] } | null>(null);
  const goldKey = `${data.accountId}`;
  useEffect(() => {
    if (goldPeriod !== "all") return;
    api<WeeklyGold[]>(`/gold/weekly?weeks=520${data.accountId ? `&account_id=${data.accountId}` : ""}`)
      .then((weeks) => setAllGold({ key: goldKey, weeks }))
      .catch(() => {});
  }, [goldPeriod, data.accountId, goldKey]);
  // Goes online, so it's off until turned on (Customize or Settings).
  const [newsOn] = usePreference<boolean>(NEWS_PREFERENCE, false);
  const [resetClockOn] = usePreference<boolean>(RESET_CLOCK_PREFERENCE, false);
  const [countersOn] = usePreference<boolean>(COUNTERS_PREFERENCE, false);
  const [groupsOn] = usePreference<boolean>(RAID_GROUPS_PREFERENCE, false);
  const { goldWeeks, gemWeeks, tracker, now } = data;
  const weekDays = tracker ? daysIntoWeek(tracker.weekly_period, now) : 0;

  const widgets = [
    {
      key: WIDGET_KEYS.goldMonth,
      node: <GoldMonthWidget weeks={goldWeeks} period={goldPeriod as Period} onPeriod={setGoldPeriod} allWeeks={allGold?.key === goldKey ? allGold.weeks : null} />,
    },
    {
      key: WIDGET_KEYS.goldGoal,
      node: (
        <GoldGoalWidget
          weeks={goldWeeks}
          daysIntoWeek={weekDays}
          onHand={data.onHand}
          boundGold={data.boundGold}
          characters={data.characters}
          mode={mode}
          onMode={setGoalMode}
          characterId={goalCharacter || null}
          onCharacter={setGoalCharacter}
          goal={goldGoal}
          onGoal={setGoldGoal}
        />
      ),
    },
    { key: WIDGET_KEYS.auction, node: <AuctionWidget /> },
    { key: WIDGET_KEYS.gems, node: <GemWidget weeks={gemWeeks} daysIntoWeek={weekDays} period={gemPeriod as Period} onPeriod={setGemPeriod} /> },
    { key: NEWS_PREFERENCE, node: <NewsWidget /> },
    {
      key: COUNTERS_PREFERENCE,
      node: <CountersWidget characters={data.characters} accountId={data.accountId} onError={data.setError} />,
    },
    {
      key: RAID_GROUPS_PREFERENCE,
      node: (
        <RaidGroupsWidget
          characters={data.allCharacters}
          raids={data.tasks.filter((t) => isActiveRaid(t))}
          isDone={(characterId, taskId) => data.completed.has(cellKey(characterId, taskId))}
          onError={data.setError}
        />
      ),
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
    if (widget.key === RAID_GROUPS_PREFERENCE) return groupsOn;
    if (widget.key === WIDGET_KEYS.auction) return view.isShown(widget.key);
    return view.isShown(widget.key) && goldWeeks.length > 0;
  });

  if (widgets.length === 0) return null;
  const position = new Map(order.map((key, index) => [key, index]));
  const items = widgets
    .map((widget) => ({ id: ALL_WIDGETS.indexOf(widget.key), key: widget.key, label: WIDGET_LABELS[widget.key] ?? widget.key, node: widget.node }))
    .sort((a, b) => (position.get(a.key) ?? 0) - (position.get(b.key) ?? 0));
  return (
    <ArrangeableList
      items={items}
      arranging={arranging}
      layout="grid"
      onReorder={(keys) => setOrder(mergeOrder(keys, order))}
      className={`grid gap-4 md:grid-cols-2 ${widgets.length === 3 ? "xl:grid-cols-3" : ""} [&>*>*:last-child]:flex-1`}
    />
  );
}
