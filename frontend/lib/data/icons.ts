/**
 * Game icons: which file in public/game-icons/ stands for what.
 *
 * The images are Smilegate RPG / Amazon Games property, bundled (never
 * hotlinked) and each listed with its source in public/game-icons/SOURCES.md
 * so any of them can be removed fast. A name without a file renders its slot
 * glyph (SLOT_GLYPHS, components/SlotIcon.tsx), so the app works with none
 * and never shows a bare generic icon for a feature.
 */

import { LOST_ARK_CLASSES } from "../classes";

/** Icon name -> file in public/game-icons/. Add a file only with its SOURCES.md line. */
export const ICON_FILES: Record<string, string> = {
  gold: "gold.webp",
  "ebony-cube": "ebony-cube.webp",
  doomfire: "doomfire.webp",
  blazing: "blazing.webp",
  "astrogem-order": "astrogem-order.webp",
  "astrogem-solidity": "astrogem-solidity.webp",
  "astrogem-immutability": "astrogem-immutability.webp",
  "astrogem-corrosion": "astrogem-corrosion.webp",
  "astrogem-distortion": "astrogem-distortion.webp",
  "astrogem-destruction": "astrogem-destruction.webp",
  "fate-ember": "fate-ember.webp",
  paradise: "paradise.webp",
  "sand-of-trial": "sand-of-trial.webp",
  "guardian-raid": "guardian-raid.webp",
  rest: "rest.webp",
  "endgame-content": "endgame-content.webp",
  // Every class in lib/classes.ts has one: class-bard.webp, ...
  ...Object.fromEntries(LOST_ARK_CLASSES.map((name) => [classIconName(name), `${classIconName(name)}.webp`])),
};

/** Names that borrow another icon until they get their own. */
const ALIASES: Record<string, string> = {
  // The bundled Order icon is Stability's.
  "astrogem-stability": "astrogem-order",
  "gold-roster": "gold",
  "gold-character": "gold",
  // Haal's Hourglass shows the Sand of Trial that powers it.
  "haals-hourglass": "sand-of-trial",
  // Library tasks: Elysian is Paradise's.
  elysian: "paradise",
};

/** The original glyphs (components/SlotIcon.tsx). */
export type SlotGlyph =
  | "banner" | "anvil" | "tome" | "compass" | "keycap" | "swords" | "sun" | "scroll" | "ledger" | "chest"
  | "hourglass" | "gavel" | "herald" | "tally" | "shields" | "bell" | "log-search" | "beacon" | "purse"
  | "chronicle" | "star" | "portal" | "skull" | "gate" | "flame" | "chest-star" | "slot";

/**
 * Features with no game art, and game things whose art isn't bundled yet:
 * name -> glyph. GameIcon shows the glyph in a slot tile when there's no file.
 */
export const SLOT_GLYPHS: Record<string, SlotGlyph> = {
  // Menu
  tracker: "banner",
  tools: "anvil",
  guides: "tome",
  settings: "compass",
  shortcuts: "keycap",
  // Cards, boxes and widgets
  "this-week": "swords",
  "gold-raids": "swords",
  today: "sun",
  "whats-left": "scroll",
  "gold-chart": "ledger",
  "gold-goal": "chest",
  resets: "hourglass",
  auction: "gavel",
  news: "herald",
  counters: "tally",
  "raid-groups": "shields",
  accounts: "shields",
  reminders: "bell",
  "loa-logs": "log-search",
  online: "beacon",
  spending: "purse",
  history: "chronicle",
  recap: "ledger",
  optimizer: "star",
  "whats-new": "star",
  everything: "star",
  // Settings sections
  characters: "shields",
  tasks: "scroll",
  raids: "swords",
  appearance: "sun",
  backup: "chest",
  // Game things, until there's a real icon
  "haals-hourglass": "hourglass",
  "milestone-missions": "tally",
  "sand-of-trial": "hourglass",
  "chaos-dungeon": "portal",
  "field-boss": "skull",
  "guardian-raid": "skull",
  "chaos-gate": "gate",
  rest: "flame",
  "bonus-box": "chest-star",
  "ebony-cube": "chest",
  gold: "chest",
  gems: "star",
  doomfire: "star",
};

export function slotGlyphFor(name: string): SlotGlyph | null {
  return SLOT_GLYPHS[name] ?? null;
}

/** Alt text for each icon, when it isn't decorative. */
const LABELS: Record<string, string> = {
  gold: "Gold",
  "gold-roster": "Roster-bound gold",
  "gold-character": "Character-bound gold",
  gems: "Gems",
  doomfire: "Doomfire gem",
  blazing: "Blazing gem",
  "astrogem-order": "Order astrogem",
  "astrogem-chaos": "Chaos astrogem",
  "astrogem-stability": "Order Astrogem: Stability",
  "astrogem-solidity": "Order Astrogem: Solidity",
  "astrogem-immutability": "Order Astrogem: Immutability",
  "astrogem-corrosion": "Chaos Astrogem: Corrosion",
  "astrogem-distortion": "Chaos Astrogem: Distortion",
  "astrogem-destruction": "Chaos Astrogem: Destruction",
  "ebony-cube": "Ebony Cube ticket",
  "haals-hourglass": "Haal's Hourglass",
  "chaos-dungeon": "Chaos Dungeon",
  "guardian-raid": "Guardian Raid",
  "field-boss": "Field Boss",
  "chaos-gate": "Chaos Gate",
  "fate-ember": "Fate Ember",
  paradise: "Paradise",
  elysian: "Elysian",
  "milestone-missions": "Milestone Missions",
  rest: "Rest bonus",
  "endgame-content": "Endgame Content",
  "sand-of-trial": "Sand of Trial",
  "bonus-box": "Bonus box",
  news: "Lost Ark news",
};

/** "Haal's Hourglass" -> "haals-hourglass". */
export function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Built-in tasks by catalog key; others go by their name. */
const TASK_ICONS: Record<string, string> = {
  "ebony-cube": "ebony-cube",
  "haals-hourglass": "haals-hourglass",
};

/**
 * A task's icon name. Every raid shares the game's "Endgame Content" badge
 * above its name (no per-raid pictures: their names read better, the user's call).
 */
export function taskIconName(task: { catalog_key: string | null; name: string; category: string }): string {
  if (task.category === "raid") return "endgame-content";
  return (task.catalog_key && TASK_ICONS[task.catalog_key]) || slug(task.name);
}

/** Logged gold and gem sources ("Field Boss", "Chaos Gate", ...). */
export function sourceIconName(source: string) {
  return slug(source);
}

/** "chaos-distortion" (lib/data/astrogems.ts GEM_TYPES) -> "astrogem-distortion". */
export function astrogemIconName(gemTypeKey: string) {
  return `astrogem-${gemTypeKey.split("-").pop()}`;
}

export function classIconName(className: string) {
  return `class-${slug(className)}`;
}

/** The file's URL, or null when there's no image for it (use the fallback). */
export function iconSrc(name: string): string | null {
  const file = ICON_FILES[name] ?? ICON_FILES[ALIASES[name] ?? ""];
  return file ? `/game-icons/${file}` : null;
}

export function iconLabel(name: string) {
  if (name.startsWith("class-")) {
    return name
      .slice(6)
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return LABELS[name] ?? name;
}
