/** The reset clock widget: when the next resets are, in your time and in UTC. */

/** Off until turned on under Customize (it's extra, not something to track). */
export const RESET_CLOCK_PREFERENCE = "widget-reset-clock";

export type ResetTime = { local: string; utc: string; countdown: string };

const MINUTE = 60_000;

/** "2d 11h", "5h 12m", "8m". */
export function countdown(until: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((until.getTime() - now.getTime()) / MINUTE));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${rest}m`;
  return `${rest}m`;
}

/**
 * A reset (an ISO time from the API, UTC) as "Wed 3:00 AM" in the viewer's
 * time zone (or `timeZone`), the same moment in UTC, and how long until it.
 */
export function describeReset(iso: string, now: Date, timeZone?: string, locale = "en-US"): ResetTime {
  const at = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  const format = (zone: string | undefined) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: zone }).format(at);
  return { local: format(timeZone), utc: format("UTC"), countdown: countdown(at, now) };
}
