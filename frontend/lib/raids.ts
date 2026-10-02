import { Character, Difficulty, Task } from "./api";

/** Gold is only paid for this many raids per character per week. */
export const GOLD_RAIDS_PER_WEEK = 3;

const SHORT_NAMES: Record<string, string> = {
  Solo: "Solo",
  Normal: "N",
  Hard: "H",
  Nightmare: "NM",
  "The First": "TF",
};

export function shortDifficulty(name: string) {
  return SHORT_NAMES[name] ?? name;
}

/** Raids still runnable: not hidden and not past their end date. */
export function isActiveRaid(task: Task, today = new Date()) {
  if (task.category !== "raid" || task.archived) return false;
  return !task.ends_on || new Date(`${task.ends_on}T10:00:00Z`) > today;
}

export function difficultyOf(character: Character, task: Task): Difficulty | undefined {
  const id = character.difficulty_ids[String(task.id)];
  return task.difficulties.find((d) => d.id === id);
}

/** The hardest group difficulty the item level allows (mirrors the backend). */
export function bestDifficulty(task: Task, itemLevel: number): Difficulty | undefined {
  const group = task.difficulties.filter((d) => d.name !== "Solo");
  const pool = group.length ? group : task.difficulties;
  const eligible = pool.filter((d) => d.min_item_level <= itemLevel);
  const byLevel = (a: Difficulty, b: Difficulty) => a.min_item_level - b.min_item_level || a.position - b.position;
  return eligible.length ? [...eligible].sort(byLevel).at(-1) : [...pool].sort(byLevel)[0];
}

/** Gold a character would earn from a raid, or null if the amount is unknown. */
export function raidGold(character: Character, task: Task): number | null {
  if (!task.difficulties.length) return task.gold;
  return difficultyOf(character, task)?.gold ?? null;
}

/** Raids a character runs that use one of their weekly gold slots. */
export function paidRaids(character: Character, tasks: Task[]) {
  if (!character.is_gold_earner) return [];
  return tasks.filter((t) => isActiveRaid(t) && !t.gold_for_everyone && character.task_ids.includes(t.id));
}

/** Most raid gold the roster can make this week, honoring the weekly limits. */
export function possibleRaidGold(characters: Character[], tasks: Task[]) {
  let total = 0;
  for (const character of characters) {
    const golds = paidRaids(character, tasks).map((t) => raidGold(character, t) ?? 0);
    total += golds.sort((a, b) => b - a).slice(0, GOLD_RAIDS_PER_WEEK).reduce((sum, g) => sum + g, 0);
  }
  // Extreme raids pay any character, but only one clear per roster.
  for (const task of tasks.filter((t) => isActiveRaid(t) && t.gold_for_everyone)) {
    const golds = characters.filter((c) => c.task_ids.includes(task.id)).map((c) => raidGold(c, task) ?? 0);
    total += task.roster_limited ? Math.max(0, ...golds) : golds.reduce((sum, g) => sum + g, 0);
  }
  return total;
}

export function formatItemLevel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatShortGold(gold: number | null) {
  if (gold === null) return "?";
  return gold >= 1000 ? `${Math.round(gold / 100) / 10}k` : String(gold);
}
