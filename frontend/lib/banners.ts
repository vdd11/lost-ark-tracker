import { parseUtc } from "./api";
import { daysIntoWeek } from "./insights";

/** The new-week recap shows through the weekend after the reset. */
export const RECAP_DAYS = 5;

/**
 * Show last week's recap: turned on, not dismissed this week, within the
 * first days of the week, and only if anything happened last week.
 */
export function shouldShowRecap({
  enabled,
  weeklyPeriod,
  dismissedWeek,
  now,
  lastWeekGold,
  lastWeekGems,
  paidRaidCharacters,
}: {
  enabled: boolean;
  weeklyPeriod: string;
  dismissedWeek: string;
  now: Date;
  lastWeekGold: number;
  lastWeekGems: number;
  paidRaidCharacters: number;
}) {
  return (
    enabled &&
    dismissedWeek !== weeklyPeriod &&
    daysIntoWeek(weeklyPeriod, now) < RECAP_DAYS &&
    (lastWeekGold > 0 || lastWeekGems > 0 || paidRaidCharacters > 0)
  );
}

/**
 * Remind to check in gold on hand: turned on, not dismissed this week, and no
 * check-in yet since this week's reset (or none ever). `lastCheckIn` is
 * undefined while loading.
 */
export function shouldRemindCheckIn({
  enabled,
  weeklyPeriod,
  dismissedWeek,
  lastCheckIn,
}: {
  enabled: boolean;
  weeklyPeriod: string;
  dismissedWeek: string;
  lastCheckIn: string | null | undefined;
}) {
  return (
    enabled &&
    lastCheckIn !== undefined &&
    dismissedWeek !== weeklyPeriod &&
    (lastCheckIn === null || parseUtc(lastCheckIn) < parseUtc(`${weeklyPeriod}T10:00:00`))
  );
}
