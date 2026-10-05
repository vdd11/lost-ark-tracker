import { Character, Difficulty, Run, Task } from "./api";

/** Gold is only paid for this many raids per character per week. */
export const GOLD_RAIDS_PER_WEEK = 3;
/** A non-earner's bonus chests are free for this many raids a week (backend raids.py). */
export const FREE_BONUS_RAIDS_PER_WEEK = 3;

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

/**
 * The raids Settings lists: event raids still running and past ones, raids a
 * user added before raids became built-in only, and built-in raids they hid.
 */
export function settingsRaidLists(tasks: Task[], today = new Date()) {
  const raids = tasks.filter((t) => t.category === "raid");
  const events = raids.filter((t) => t.ends_on);
  return {
    live: events.filter((t) => isActiveRaid(t, today)),
    past: events.filter((t) => !isActiveRaid(t, today)),
    custom: raids.filter((t) => !t.catalog_key && !t.ends_on && !t.archived),
    hidden: raids.filter((t) => t.catalog_key && t.archived),
  };
}

/** "50% roster", "100% character", or "" when none of the gold is bound. */
export function boundLabel(percent: number, kind: string) {
  return percent > 0 ? `${percent}% ${kind}` : "";
}

export function difficultyOf(character: Character, task: Task): Difficulty | undefined {
  const id = character.difficulty_ids[String(task.id)];
  return task.difficulties.find((d) => d.id === id);
}

/** The hardest difficulty the item level allows, else the easiest (mirrors the backend). */
export function bestDifficulty(task: Task, itemLevel: number): Difficulty | undefined {
  const eligible = task.difficulties.filter((d) => d.min_item_level <= itemLevel);
  const byLevel = (a: Difficulty, b: Difficulty) => a.min_item_level - b.min_item_level || a.position - b.position;
  return eligible.length ? [...eligible].sort(byLevel).at(-1) : [...task.difficulties].sort(byLevel)[0];
}

/** Whether a character's item level reaches at least the easiest difficulty. */
export function canRun(character: Character, task: Task) {
  return task.difficulties.some((d) => d.min_item_level <= character.item_level);
}

/** Raids worth suggesting for a new character: the top N by gold they qualify for. */
export function topGoldRaids(raids: Task[], itemLevel: number, limit = GOLD_RAIDS_PER_WEEK) {
  return raids
    .filter((t) => !t.gold_for_everyone)
    .map((task) => ({ task, difficulty: bestDifficulty(task, itemLevel) }))
    .filter((pick): pick is { task: Task; difficulty: Difficulty } =>
      Boolean(pick.difficulty && pick.difficulty.min_item_level <= itemLevel),
    )
    .sort((a, b) => (b.difficulty.gold ?? 0) - (a.difficulty.gold ?? 0))
    .slice(0, limit);
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

/** Gold a clear this week pays at the difficulty it was run on. */
function runGold(task: Task, run: Run) {
  if (!task.difficulties.length) return task.gold;
  return task.difficulties.find((d) => d.id === run.difficulty_id)?.gold ?? 0;
}

const sumTop = (golds: number[], n: number) =>
  [...golds].sort((a, b) => b - a).slice(0, Math.max(0, n)).reduce((sum, g) => sum + g, 0);

export type GoldRaidWeek = {
  /** Raids that will pay this week: up to 3, from clears plus usual raids. */
  slots: number;
  /** Paying clears so far (extra clears past the limit don't count). */
  cleared: number;
  left: number;
  possible: number;
};

/**
 * A gold earner's week. Clears count first (even raids they don't usually
 * run), then their usual raids fill the remaining slots, then the best other
 * raids they can enter, so the gold earned can never pass what's possible.
 */
export function goldRaidWeek(character: Character, tasks: Task[], runs: Run[] = []): GoldRaidWeek {
  if (!character.is_gold_earner) return { slots: 0, cleared: 0, left: 0, possible: 0 };
  const mine = new Map(runs.filter((r) => r.character_id === character.id).map((r) => [r.task_id, r]));
  const raids = tasks.filter((t) => isActiveRaid(t) && !t.gold_for_everyone);
  const clearedGold = raids.filter((t) => mine.has(t.id)).map((t) => runGold(t, mine.get(t.id)!));
  const usual = paidRaids(character, tasks).filter((t) => !mine.has(t.id));
  const others = topGoldRaids(
    raids.filter((t) => !mine.has(t.id) && !usual.includes(t)),
    character.item_level,
    GOLD_RAIDS_PER_WEEK - clearedGold.length - usual.length,
  );
  const plannedGold = [
    ...usual.map((t) => raidGold(character, t) ?? 0),
    ...others.map(({ difficulty }) => difficulty.gold ?? 0),
  ];
  const cleared = Math.min(clearedGold.length, GOLD_RAIDS_PER_WEEK);
  const slots = Math.min(GOLD_RAIDS_PER_WEEK, clearedGold.length + plannedGold.length);
  const left = slots - cleared;
  return {
    slots,
    cleared,
    left,
    possible: sumTop(clearedGold, GOLD_RAIDS_PER_WEEK) + sumTop(plannedGold, left),
  };
}

/** Characters split by account, since each account is its own roster. */
export function byAccount(characters: Character[]) {
  const groups = new Map<number, Character[]>();
  for (const character of characters) {
    groups.set(character.account_id, [...(groups.get(character.account_id) ?? []), character]);
  }
  return [...groups.values()];
}

/** Event (Extreme) raids pay any character; roster-limited ones once per account. */
function eventWeeks(characters: Character[], tasks: Task[], runs: Run[]) {
  return tasks
    .filter((t) => isActiveRaid(t) && t.gold_for_everyone)
    .flatMap((task) => {
      const goldOf = (c: Character) => {
        const run = runs.find((r) => r.task_id === task.id && r.character_id === c.id);
        if (run) return { cleared: true, gold: runGold(task, run) };
        return { cleared: false, gold: c.task_ids.includes(task.id) ? (raidGold(c, task) ?? 0) : 0 };
      };
      if (!task.roster_limited) {
        return [{ possible: characters.reduce((sum, c) => sum + goldOf(c).gold, 0), left: 0 }];
      }
      return byAccount(characters).map((roster) => {
        const results = roster.map(goldOf);
        const cleared = results.filter((r) => r.cleared);
        return {
          possible: Math.max(0, ...(cleared.length ? cleared : results).map((r) => r.gold)),
          left: cleared.length === 0 && roster.some((c) => canRun(c, task)) ? 1 : 0,
        };
      });
    });
}

/** Most raid gold the roster can make this week, honoring the weekly limits. */
export function possibleRaidGold(characters: Character[], tasks: Task[], runs: Run[] = []) {
  const raids = characters.reduce((sum, c) => sum + goldRaidWeek(c, tasks, runs).possible, 0);
  return raids + eventWeeks(characters, tasks, runs).reduce((sum, e) => sum + e.possible, 0);
}

/** Gold-paying raids still to run this week, across the roster. */
export function goldRaidsLeft(characters: Character[], tasks: Task[], runs: Run[] = []) {
  const weeks = characters.map((c) => goldRaidWeek(c, tasks, runs));
  return {
    left: weeks.reduce((sum, w) => sum + w.left, 0),
    slots: weeks.reduce((sum, w) => sum + w.slots, 0),
    events: eventWeeks(characters, tasks, runs).reduce((sum, e) => sum + e.left, 0),
  };
}

export function formatItemLevel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatShortGold(gold: number | null) {
  if (gold === null) return "?";
  return gold >= 1000 ? `${Math.round(gold / 100) / 10}k` : String(gold);
}
