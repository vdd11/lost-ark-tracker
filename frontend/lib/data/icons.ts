/**
 * Game icons: which file in public/game-icons/ stands for what.
 *
 * The images are Smilegate RPG / Amazon Games property, bundled (never
 * hotlinked) and each listed with its source in public/game-icons/SOURCES.md
 * so any of them can be removed fast. A name without a file here renders its
 * Lucide fallback (components/GameIcon.tsx), so the app works with none.
 */

/** Icon name -> file in public/game-icons/. Add a file only with its SOURCES.md line. */
export const ICON_FILES: Record<string, string> = {};

/** Names that borrow another icon until they get their own. */
const ALIASES: Record<string, string> = {
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
  "ebony-cube": "Ebony Cube ticket",
  "haals-hourglass": "Haal's Hourglass",
  "chaos-dungeon": "Chaos Dungeon",
  "guardian-raid": "Guardian Raid",
  "field-boss": "Field Boss",
  "chaos-gate": "Chaos Gate",
  "fate-ember": "Fate Ember",
  paradise: "Paradise",
  serca: "Serca",
  "horizon-cathedral": "Horizon Cathedral",
  "the-final-day": "The Final Day",
  "act-4": "Act 4",
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
  "shadow-serca": "serca",
  "abyss-cathedral": "horizon-cathedral",
  "kazeros-denouement": "the-final-day",
  "kazeros-act-4": "act-4",
  "ebony-cube": "ebony-cube",
  "haals-hourglass": "haals-hourglass",
};

export function taskIconName(task: { catalog_key: string | null; name: string }) {
  return (task.catalog_key && TASK_ICONS[task.catalog_key]) || slug(task.name);
}

/** Logged gold and gem sources ("Field Boss", "Chaos Gate", ...). */
export function sourceIconName(source: string) {
  return slug(source);
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
