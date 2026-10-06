import { Character, Run, Task } from "./api";
import { cellKey } from "./trackerSections";

export type Blessing = "azena" | "innana";

export const BLESSINGS: { id: Blessing; field: "azena_until" | "innana_until"; label: string; help: string }[] = [
  { id: "azena", field: "azena_until", label: "Azena's", help: "Blessed embers can drop from Chaos Dungeon and Guardian Raid" },
  { id: "innana", field: "innana_until", label: "Innana's", help: "A second Chaos Dungeon (Chaos Rift, 1730+) run each day" },
];

/** Innana's extra daily run is for Chaos Rift, which starts at this item level. */
export const CHAOS_RIFT_ITEM_LEVEL = 1730;

/** The game day (dailies reset at 10:00 UTC), as YYYY-MM-DD. */
export function gameDay(now: Date) {
  return new Date(now.getTime() - 10 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Whether a blessing is on for the given game day: it lasts through its end date. */
export function blessingActive(character: Pick<Character, "azena_until" | "innana_until">, blessing: Blessing, day: string) {
  const until = blessing === "azena" ? character.azena_until : character.innana_until;
  return Boolean(until && until >= day);
}

/** Chaos Dungeon runs a character has each day: two with Innana's at Chaos Rift item level. */
export function chaosRunsPerDay(character: Character, day: string) {
  return blessingActive(character, "innana", day) && character.item_level >= CHAOS_RIFT_ITEM_LEVEL ? 2 : 1;
}

/** The daily Innana's doubles (by name: the built-in task). */
export const CHAOS_DUNGEON = "Chaos Dungeon";

/** Runs that make a daily done today for a character: 2 for Chaos Dungeon with Innana's, else 1. */
export function dailyRunsNeeded(character: Character, task: Task, day: string | null | undefined) {
  if (!day || task.category !== "daily" || task.name !== CHAOS_DUNGEON) return 1;
  return chaosRunsPerDay(character, day);
}

/**
 * The cells that count as done: every completion, except a daily that still
 * has a run to go (the first of two Innana's runs is only half done).
 */
export function fullyDone(completed: Set<string>, runs: Run[], characters: Character[], tasks: Task[], day: string | null | undefined) {
  const done = new Set(completed);
  const byId = new Map(characters.map((c) => [c.id, c]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const run of runs) {
    const character = byId.get(run.character_id);
    const task = taskById.get(run.task_id);
    if (character && task && run.count < dailyRunsNeeded(character, task, day)) done.delete(cellKey(run.character_id, run.task_id));
  }
  return done;
}
