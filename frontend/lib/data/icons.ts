/**
 * Game icons: which file in public/game-icons/ stands for what.
 *
 * The images are Smilegate RPG / Amazon Games property, bundled (never
 * hotlinked) and each listed with its source in public/game-icons/SOURCES.md
 * so any of them can be removed fast. A name without a file here renders its
 * Lucide fallback (components/GameIcon.tsx), so the app works with none.
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
  // Every class in lib/classes.ts has one: class-bard.webp, ...
  ...Object.fromEntries(LOST_ARK_CLASSES.map((name) => [classIconName(name), `${classIconName(name)}.webp`])),
};

/** Names that borrow another icon until they get their own. */
const ALIASES: Record<string, string> = {
  // The bundled Order icon is Stability's.
  "astrogem-stability": "astrogem-order",
  "gold-roster": "gold",
  "gold-character": "gold",
};

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
  rest: "Rest bonus",
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

/** A task's icon name, or null for raids: their names read better than pictures (the user's call). */
export function taskIconName(task: { catalog_key: string | null; name: string; category: string }): string | null {
  if (task.category === "raid") return null;
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
