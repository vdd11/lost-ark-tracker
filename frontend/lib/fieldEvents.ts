/**
 * Field Boss and Chaos Gate: on set days, from the daily reset. Their gem
 * drops are random, so players log what they got (opt-in, under Customize).
 *
 * Days (checked 2026-10-06):
 * - Chaos Gate: Monday, Thursday, Saturday and Sunday, "every hour, starting
 *   from daily reset". Maxroll, "Chaos Gate", updated 2025-06-04:
 *   https://maxroll.gg/lost-ark/resources/chaos-gate-and-maps
 * - Field Boss: Tuesday, Friday and Sunday. Community guides (e.g.
 *   gamepressure.com "Field Bosses"); no official page lists it.
 */

export const FIELD_EVENTS_PREFERENCE = "field-events";

export type FieldEvent = "Field Boss" | "Chaos Gate";

/** Days of the week, 0 = Sunday, as JavaScript's getUTCDay counts them. */
export const FIELD_EVENT_DAYS: Record<FieldEvent, number[]> = {
  "Field Boss": [2, 5, 0],
  "Chaos Gate": [1, 4, 6, 0],
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The game day a daily period ("2026-10-05", the date of its 10:00 UTC reset) falls on. */
function weekday(dailyPeriod: string) {
  return new Date(`${dailyPeriod}T12:00:00Z`).getUTCDay();
}

export function eventsOn(dailyPeriod: string): FieldEvent[] {
  const day = weekday(dailyPeriod);
  return (Object.keys(FIELD_EVENT_DAYS) as FieldEvent[]).filter((event) => FIELD_EVENT_DAYS[event].includes(day));
}

/** "Chaos Gate on Thursday": the next day either event is up, for days with neither. */
export function nextEvent(dailyPeriod: string): { event: FieldEvent; day: string } | null {
  const today = weekday(dailyPeriod);
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = (today + ahead) % 7;
    const event = (Object.keys(FIELD_EVENT_DAYS) as FieldEvent[]).find((e) => FIELD_EVENT_DAYS[e].includes(day));
    if (event) return { event, day: ahead === 1 ? "tomorrow" : `on ${DAY_NAMES[day]}` };
  }
  return null;
}

/** What to log from the form: gem counts by level (only the ones filled in) and gold from selling. */
export function dropsFrom(gemDrafts: Record<number, string>, goldDraft: string) {
  const gems: Record<number, number> = {};
  for (const [level, text] of Object.entries(gemDrafts)) {
    const count = Math.floor(Number(text));
    if (text.trim() !== "" && Number.isFinite(count) && count > 0) gems[Number(level)] = count;
  }
  const gold = Math.max(0, Math.floor(Number(goldDraft) || 0));
  return { gems: Object.keys(gems).length ? gems : null, gold };
}
