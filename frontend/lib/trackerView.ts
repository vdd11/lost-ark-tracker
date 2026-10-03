import { Character, Task } from "./api";
import { canRun, isActiveRaid } from "./raids";

/** The tracker's cards, by how often things reset. */
export type Section = "week" | "today" | "anytime";

/**
 * Raids and weekly content (Haal's Hourglass) reset Wednesday; dailies reset
 * every day; counted content (Ebony Cube) is run whenever you have tickets.
 */
export function sectionOf(task: Task): Section {
  if (task.category === "daily") return "today";
  if (task.counted) return "anytime";
  return "week";
}

/** Stable key for show/hide choices: catalog key if built in, else the name. */
export function viewKey(task: Task) {
  return `task:${task.catalog_key ?? task.name}`;
}

export const SECTION_KEYS = { gold: "section:gold", today: "section:today", anytime: "section:anytime" } as const;
export const CHARACTER_BOUND_KEY = "column:character-bound";

/** Hidden until someone turns them on in Customize. */
export const DEFAULT_HIDDEN = ["task:Guardian Raid"];

export function parseHidden(raw: string) {
  return new Set(raw.split("|").filter(Boolean));
}

export function serializeHidden(hidden: Set<string>) {
  return [...hidden].sort().join("|");
}

/** Whether a task applies to a character at all right now (usual, or enterable). */
export function appliesTo(character: Character, task: Task) {
  const tiered = task.difficulties.length > 0;
  if (task.category === "raid") return character.task_ids.includes(task.id) || (tiered && canRun(character, task));
  return character.task_ids.includes(task.id) && (!tiered || canRun(character, task));
}

/** Counts toward a card's progress: the character's usual tasks they can enter. */
export function countsForProgress(character: Character, task: Task) {
  if (!character.task_ids.includes(task.id)) return false;
  if (task.category === "raid") return isActiveRaid(task);
  return task.difficulties.length === 0 || canRun(character, task);
}
