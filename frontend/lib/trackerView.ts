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

export const SECTION_KEYS = {
  gold: "section:gold",
  today: "section:today",
  anytime: "section:anytime",
  recap: "section:recap",
} as const;
export const CHARACTER_BOUND_KEY = "column:character-bound";
/** Hiding this hides characters who've finished everything in a card. */
export const FINISHED_ROWS_KEY = "rows:finished";
/** Hiding this shows usual raids as a plain label instead of a difficulty dropdown. */
export const RAID_PICKERS_KEY = "cells:raid-pickers";

/** The boxes along the top of the tracker. */
export const STAT_KEYS = {
  raidsLeft: "stat:raids-left",
  raidGold: "stat:raid-gold",
  otherGold: "stat:other-gold",
  total: "stat:total",
  leftToUse: "stat:left-to-use",
} as const;

/** Insight widgets under the tracker. */
export const WIDGET_KEYS = {
  goldMonth: "widget:gold-month",
  goldGoal: "widget:gold-goal",
  gems: "widget:gems",
  auction: "widget:auction",
} as const;
/** Older versions kept the (then default-on) news widget in the hidden set; it's opt-in now (lib/online.ts). */
const RETIRED_KEYS = ["widget:news"];

/** Pages that can be dropped from the menu. */
export const PAGE_KEYS = { gold: "page:gold", gems: "page:gems", tools: "page:tools", guides: "page:guides" } as const;

/** Hidden until someone turns them on in Customize. */
export const DEFAULT_HIDDEN = ["task:Guardian Raid"];
export const DEFAULT_HIDDEN_RAW = DEFAULT_HIDDEN.join("|");
/** The stored preference both the tracker and the menu read. */
export const HIDDEN_PREFERENCE = "tracker-hidden";

export function parseHidden(raw: string) {
  const hidden = new Set(raw.split("|").filter((key) => key && !RETIRED_KEYS.includes(key)));
  // Older versions had one switch for all the gold boxes.
  if (hidden.delete(SECTION_KEYS.gold)) Object.values(STAT_KEYS).forEach((key) => hidden.add(key));
  return hidden;
}

export type Style = "casual" | "regular" | "everything";

export const STYLES: { id: Style; label: string; description: string }[] = [
  { id: "casual", label: "Just raids", description: "Weekly raids, gold raids left and raid gold. Nothing else." },
  { id: "regular", label: "Raids + dailies", description: "Raids, Hourglass, Ebony Cube and Chaos Dungeon, with gold totals and charts." },
  { id: "everything", label: "Everything", description: "Every task, gold box, chart and page, including Guardian Raid and char-bound gold. (Online extras stay off until you turn them on.)" },
];

/** What a play style hides, given today's tasks. */
export function styleHidden(style: Style, tasks: Task[]): Set<string> {
  if (style === "everything") return new Set();
  if (style === "regular") return new Set(DEFAULT_HIDDEN);
  return new Set([
    ...DEFAULT_HIDDEN,
    SECTION_KEYS.today,
    SECTION_KEYS.anytime,
    CHARACTER_BOUND_KEY,
    STAT_KEYS.otherGold,
    STAT_KEYS.total,
    STAT_KEYS.leftToUse,
    PAGE_KEYS.gems,
    PAGE_KEYS.tools,
    ...Object.values(WIDGET_KEYS),
    ...tasks.filter((t) => t.category !== "raid" && sectionOf(t) === "week").map(viewKey),
  ]);
}

/** The play style the current choices match exactly, if any. */
export function matchingStyle(hidden: Set<string>, tasks: Task[]): Style | null {
  const current = serializeHidden(hidden);
  return STYLES.find((style) => serializeHidden(styleHidden(style.id, tasks)) === current)?.id ?? null;
}

/**
 * What "mark all done" ticks off for a character in a card: their usual tasks
 * not done yet. Run counters (Ebony Cube) need a count, and once-per-account
 * events are a deliberate pick, so both are left to do by hand.
 */
export function remainingFor(character: Character, columns: Task[], isDone: (task: Task) => boolean) {
  return columns.filter(
    (task) => countsForProgress(character, task) && !isDone(task) && !task.counted && !task.roster_limited,
  );
}

/**
 * Whether a character has finished everything they count for in a card, so
 * they can be tucked away. Someone with nothing to count isn't "finished".
 */
export function isFinished(character: Character, columns: Task[], isDone: (task: Task) => boolean) {
  const counted = columns.filter((task) => countsForProgress(character, task));
  return counted.length > 0 && counted.every(isDone);
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
