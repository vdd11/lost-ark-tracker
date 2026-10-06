import { Character, RestState, Run, Task } from "./api";
import { eventsOn } from "./fieldEvents";
import { appliesTo } from "./trackerView";

export type Nudge = { key: string; icon: string; text: string; title: string };

const names = (list: Character[]) => list.map((c) => c.name).join(", ");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The home strip's short reminders, from what the tracker already knows:
 * rest gauges that are full (a run there wastes nothing, skipping it wastes
 * rest), Haal's Hourglass not run yet this week, and Field Boss / Chaos Gate
 * days when their drop logging is on.
 */
export function homeNudges({
  characters,
  tasks,
  rests,
  runs,
  dailyPeriod,
  fieldEvents,
}: {
  characters: Character[];
  tasks: Task[];
  rests: RestState[];
  runs: Run[];
  dailyPeriod: string | null;
  fieldEvents: boolean;
}): Nudge[] {
  const nudges: Nudge[] = [];

  for (const task of tasks.filter((t) => t.rest_max > 0)) {
    const full = characters.filter(
      (c) => c.task_ids.includes(task.id) && rests.some((r) => r.character_id === c.id && r.task_id === task.id && r.value >= task.rest_max),
    );
    if (full.length) {
      nudges.push({
        key: `rest-${task.id}`,
        icon: "rest",
        text: `${task.name} rest full on ${plural(full.length, "character")}`,
        title: `Rest bonus is at its cap, so skipping today wastes it: ${names(full)}`,
      });
    }
  }

  for (const task of tasks.filter((t) => t.sand_scaled)) {
    const left = characters.filter((c) => appliesTo(c, task) && !runs.some((r) => r.character_id === c.id && r.task_id === task.id));
    if (left.length) {
      nudges.push({
        key: `hourglass-${task.id}`,
        icon: "haals-hourglass",
        text: `${task.name} left on ${plural(left.length, "character")}`,
        title: `Not run yet this week: ${names(left)}`,
      });
    }
  }

  if (fieldEvents && dailyPeriod) {
    for (const event of eventsOn(dailyPeriod)) {
      nudges.push({ key: event, icon: event === "Field Boss" ? "field-boss" : "chaos-gate", text: `${event} today`, title: `${event} is up today, from the daily reset` });
    }
  }
  return nudges;
}
