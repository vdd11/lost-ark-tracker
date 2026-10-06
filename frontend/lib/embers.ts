import { Character, EmberWeek, Task } from "./api";

/** Logging embers is opt-in (Customize → Today). */
export const EMBERS_PREFERENCE = "ember-logging";

/** The dailies that drop fate embers (and blessed ones with Azena's blessing), by name: the built-in tasks. */
export const EMBER_TASKS = ["Chaos Dungeon", "Guardian Raid"];

export function dropsEmbers(task: Task) {
  return task.category === "daily" && EMBER_TASKS.includes(task.name);
}

/** This week's embers for the shown characters, summed. */
export function embersThisWeek(embers: EmberWeek[], characters: Character[]) {
  const shown = new Set(characters.map((c) => c.id));
  return embers
    .filter((e) => shown.has(e.character_id))
    .reduce((sum, e) => ({ fate: sum.fate + e.fate, blessed: sum.blessed + e.blessed }), { fate: 0, blessed: 0 });
}
