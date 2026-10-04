import { Character, RestState, Run, Task } from "./api";
import { goldRaidWeek } from "./raids";
import { cellKey, formatCountdown } from "./trackerSections";

/**
 * Reminders before a reset (opt-in, in Settings). The app only runs while a
 * tab is open, so these are checked from the page; reset times come from the
 * API (backend/resets.py), never recomputed here.
 */

export type Reminder = {
  /** The reset this is for, so it fires once per reset. */
  resetKey: string;
  title: string;
  body: string;
};

export const LEAD_HOURS = { weekly: [1, 2, 3, 6, 12, 24], daily: [1, 2, 3, 6] } as const;
export const DEFAULT_LEAD = { weekly: 3, daily: 2 } as const;

const HOUR = 60 * 60 * 1000;

/** Within the lead time before a reset, and not already reminded for it. */
function due(now: Date, nextReset: Date, leadHours: number, lastNotifiedFor: string) {
  const key = nextReset.toISOString();
  const inWindow = now.getTime() >= nextReset.getTime() - leadHours * HOUR && now < nextReset;
  return inWindow && lastNotifiedFor !== key ? key : null;
}

/** Gold raids each gold earner still has to run this week. */
export function weeklyItems(characters: Character[], tasks: Task[], runs: Run[]) {
  return characters
    .map((character) => ({ name: character.name, left: goldRaidWeek(character, tasks, runs).left }))
    .filter((item) => item.left > 0);
}

export function weeklyReminder({
  now,
  nextReset,
  leadHours,
  lastNotifiedFor,
  items,
}: {
  now: Date;
  nextReset: Date;
  leadHours: number;
  lastNotifiedFor: string;
  items: { name: string; left: number }[];
}): Reminder | null {
  const total = items.reduce((sum, item) => sum + item.left, 0);
  const resetKey = total > 0 ? due(now, nextReset, leadHours, lastNotifiedFor) : null;
  if (!resetKey) return null;
  return {
    resetKey,
    title: "Gold raids left this week",
    body:
      `${total} gold raid${total === 1 ? "" : "s"} left, weekly reset in ${formatCountdown(nextReset, now)}: ` +
      `${items.map((item) => `${item.name} ${item.left}`).join(", ")}.`,
  };
}

/**
 * Dailies whose rest gauge is full on characters who haven't run them today:
 * skipping another day would waste that day's rest.
 */
export function fullRestItems(characters: Character[], tasks: Task[], rest: RestState[], completed: Set<string>) {
  return tasks
    .filter((task) => task.category === "daily" && task.rest_max > 0)
    .map((task) => ({
      task: task.name,
      names: characters
        .filter((c) => c.task_ids.includes(task.id) && !completed.has(cellKey(c.id, task.id)))
        .filter((c) => (rest.find((r) => r.character_id === c.id && r.task_id === task.id)?.value ?? 0) >= task.rest_max)
        .map((c) => c.name),
    }))
    .filter((item) => item.names.length > 0);
}

export function dailyReminder({
  now,
  nextReset,
  leadHours,
  lastNotifiedFor,
  items,
}: {
  now: Date;
  nextReset: Date;
  leadHours: number;
  lastNotifiedFor: string;
  items: { task: string; names: string[] }[];
}): Reminder | null {
  const resetKey = items.length > 0 ? due(now, nextReset, leadHours, lastNotifiedFor) : null;
  if (!resetKey) return null;
  const countdown = formatCountdown(nextReset, now);
  return {
    resetKey,
    title: "Rest is full",
    body: items
      .map(
        ({ task, names }) =>
          `${task} rest is full on ${names.length} character${names.length === 1 ? "" : "s"} (${names.join(", ")}): ` +
          `run it before the daily reset in ${countdown} or that day's rest is lost.`,
      )
      .join(" "),
  };
}

/** Saved in this browser (usePreference keys). */
export const REMINDER_KEYS = {
  weekly: "reminder-weekly",
  weeklyLead: "reminder-weekly-lead",
  daily: "reminder-daily",
  dailyLead: "reminder-daily-lead",
  lastWeekly: "reminder-last-weekly",
  lastDaily: "reminder-last-daily",
} as const;
