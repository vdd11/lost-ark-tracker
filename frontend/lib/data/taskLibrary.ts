import { TaskCategory } from "../api";

/**
 * Optional tasks added in one click from Settings → Tasks → "Add from the
 * library". Each has where its rule comes from and when it was checked.
 * `confirmed: false` entries stay hidden until the rule is confirmed against
 * official NA notes or by the user (CLAUDE.md: never invent game numbers).
 */
export type LibraryTask = {
  id: string;
  name: string;
  /** When it resets. */
  category: Exclude<TaskCategory, "raid">;
  /** Times (or points) a period; 0 = a plain checkbox. */
  limit: number;
  /** Per character (a tracker task), or once for the roster (a counter that resets). */
  scope: "character" | "roster";
  /** A GameIcon name. */
  icon: string;
  description: string;
  source: { label: string; url: string; checked: string };
  confirmed: boolean;
};

export const TASK_LIBRARY: LibraryTask[] = [
  {
    id: "elysian",
    name: "Elysian",
    category: "weekly",
    limit: 5,
    scope: "character",
    icon: "paradise",
    description: "Paradise: at least 5 entries per character a week. Raise the limit if you have bonus entries (Crucible clears, Azena's blessing, ...).",
    source: {
      label: "playlostark.com, Welcome to Paradise",
      url: "https://www.playlostark.com/en-us/game/releases/welcome-to-paradise",
      checked: "2026-10-06",
    },
    confirmed: true,
  },
  {
    id: "milestone-missions",
    name: "Milestone Missions",
    category: "weekly",
    limit: 300,
    scope: "character",
    icon: "counters",
    description: "Weekly mission points per character: up to 300 a week (up to 1,000 can be held).",
    source: {
      label: "playlostark.com, Guardians' Rage release notes (Feb 4, 2026)",
      url: "https://www.playlostark.com/game/releases/guardians-rage",
      checked: "2026-10-06",
    },
    confirmed: true,
  },
  {
    // The Feb 2026 notes replace the weekly Una's Task; whether the daily ones remain isn't stated.
    id: "daily-unas-tasks",
    name: "Daily Una's Tasks",
    category: "daily",
    limit: 3,
    scope: "character",
    icon: "whats-new",
    description: "Daily Una's Tasks.",
    source: { label: "Not confirmed in official notes", url: "https://www.playlostark.com/game/releases/guardians-rage", checked: "2026-10-06" },
    confirmed: false,
  },
  {
    id: "stronghold",
    name: "Stronghold collect & restart",
    category: "daily",
    limit: 0,
    scope: "character",
    icon: "tracker",
    description: "Collect Stronghold crafts and research and start the next ones.",
    source: { label: "Not confirmed in official notes", url: "https://www.playlostark.com", checked: "2026-10-06" },
    confirmed: false,
  },
  {
    id: "life-energy",
    name: "Life Skill energy",
    category: "daily",
    limit: 0,
    scope: "roster",
    icon: "rest",
    description: "Roster-wide Life Skill energy.",
    source: { label: "Guides only; not in official notes", url: "https://www.playlostark.com", checked: "2026-10-06" },
    confirmed: false,
  },
];

/** What Settings offers: confirmed entries, minus ones already added (by name). */
export function libraryOffers(existingNames: string[], library: LibraryTask[] = TASK_LIBRARY) {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return library.filter((entry) => entry.confirmed).map((entry) => ({ ...entry, added: taken.has(entry.name.toLowerCase()) }));
}
