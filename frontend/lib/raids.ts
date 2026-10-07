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


/** A raid's gold and the part of it that isn't character-bound (tradeable + roster-bound). */
type Pay = { gold: number; shared: number };

function pay(gold: number, difficulty?: Difficulty): Pay {
  const characterBound = difficulty && difficulty.bound_kind === "character" ? difficulty.bound_percent : 0;
  return { gold, shared: Math.round((gold * (100 - characterBound)) / 100) };
}

/** The gates a clear covers, {gate: difficulty_id}: all of them for a whole clear; empty without one. */
export function clearedGates(task: Task, run: Run | undefined): Record<number, number | null> {
  if (!run) return {};
  if (run.gates) return Object.fromEntries(Object.entries(run.gates).map(([gate, id]) => [Number(gate), id]));
  return Object.fromEntries(Array.from({ length: task.gate_count ?? 0 }, (_, i) => [i + 1, run.difficulty_id]));
}

/** A completion body that sets every gate exactly as a clear had them (0 = not cleared), for Undo. */
export function gatesBody(task: Task, run: Run | undefined): Record<number, number> {
  const done = clearedGates(task, run);
  return Object.fromEntries(Array.from({ length: task.gate_count }, (_, i) => [i + 1, done[i + 1] ?? 0]));
}

/** Whether a raid's clear covers every gate (raids without gates: whether there's a clear). */
export function isWholeClear(task: Task, run: Run | undefined) {
  if (!run) return false;
  return !task.gate_count || !run.gates || Object.keys(run.gates).length >= task.gate_count;
}

/** One gate's gold at a difficulty, or null when that split isn't known. */
export function gateGold(task: Task, difficultyId: number | null | undefined, gate: number): number | null {
  const difficulty = task.difficulties.find((d) => d.id === difficultyId);
  return difficulty?.gate_gold?.[gate - 1] ?? null;
}

/** Gold for some gates, each at its own difficulty (an unknown split pays nothing yet). */
function gatesPay(task: Task, gates: Record<number, number | null>): Pay {
  return Object.entries(gates).reduce(
    (sum, [gate, id]) => {
      const p = pay(gateGold(task, id, Number(gate)) ?? 0, task.difficulties.find((d) => d.id === id));
      return { gold: sum.gold + p.gold, shared: sum.shared + p.shared };
    },
    { gold: 0, shared: 0 },
  );
}

function runPay(task: Task, run: Run): Pay {
  if (!task.difficulties.length) return pay(task.gold);
  if (run.gates) return gatesPay(task, clearedGates(task, run));
  const difficulty = task.difficulties.find((d) => d.id === run.difficulty_id);
  return pay(difficulty?.gold ?? 0, difficulty);
}

/** The gates still to clear after a partial clear, at the clear's difficulty (or the usual one). */
export function remainingGates(task: Task, run: Run | undefined, difficultyId: number | null | undefined): Record<number, number | null> {
  if (!run || isWholeClear(task, run)) return {};
  const done = clearedGates(task, run);
  const at = difficultyId ?? run.difficulty_id;
  return Object.fromEntries(
    Array.from({ length: task.gate_count }, (_, i) => i + 1)
      .filter((gate) => !(gate in done))
      .map((gate) => [gate, at]),
  );
}

/** Gold a partly cleared raid can still pay. */
export function remainingGateGold(task: Task, run: Run | undefined, difficultyId: number | null | undefined) {
  return gatesPay(task, remainingGates(task, run, difficultyId)).gold;
}

/** What a clear can pay in all: its gates so far, plus the rest at its difficulty. */
function runPotential(task: Task, run: Run): Pay {
  const done = runPay(task, run);
  const rest = gatesPay(task, remainingGates(task, run, undefined));
  return { gold: done.gold + rest.gold, shared: done.shared + rest.shared };
}

/** The best n paydays by gold, summed both ways. */
const sumTop = (pays: Pay[], n: number) =>
  [...pays]
    .sort((a, b) => b.gold - a.gold)
    .slice(0, Math.max(0, n))
    .reduce((sum, p) => ({ gold: sum.gold + p.gold, shared: sum.shared + p.shared }), { gold: 0, shared: 0 });

export type GoldRaidWeek = {
  /** Raids that will pay this week: up to 3, from clears plus usual raids. */
  slots: number;
  /** Paying raids cleared so far (extra clears past the limit don't count); a
   * raid with only some gates cleared holds its slot but is still left. */
  cleared: number;
  left: number;
  possible: number;
  /** The part of `possible` that isn't character-bound. */
  possibleShared: number;
};

/**
 * A gold earner's week. Clears count first (even raids they don't usually
 * run), then their usual raids fill the remaining slots, then the best other
 * raids they can enter, so the gold earned can never pass what's possible.
 */
export function goldRaidWeek(character: Character, tasks: Task[], runs: Run[] = []): GoldRaidWeek {
  if (!character.is_gold_earner) return { slots: 0, cleared: 0, left: 0, possible: 0, possibleShared: 0 };
  const mine = new Map(runs.filter((r) => r.character_id === character.id).map((r) => [r.task_id, r]));
  const raids = tasks.filter((t) => isActiveRaid(t) && !t.gold_for_everyone);
  const ran = raids.filter((t) => mine.has(t.id));
  // A partly cleared raid counts what all its gates can pay.
  const clearedGold = ran.map((t) => runPotential(t, mine.get(t.id)!));
  const whole = ran.filter((t) => isWholeClear(t, mine.get(t.id))).length;
  const usual = paidRaids(character, tasks).filter((t) => !mine.has(t.id));
  const others = topGoldRaids(
    raids.filter((t) => !mine.has(t.id) && !usual.includes(t)),
    character.item_level,
    GOLD_RAIDS_PER_WEEK - clearedGold.length - usual.length,
  );
  const plannedGold = [
    ...usual.map((t) => pay(raidGold(character, t) ?? 0, difficultyOf(character, t))),
    ...others.map(({ difficulty }) => pay(difficulty.gold ?? 0, difficulty)),
  ];
  const cleared = Math.min(whole, GOLD_RAIDS_PER_WEEK);
  const slots = Math.min(GOLD_RAIDS_PER_WEEK, clearedGold.length + plannedGold.length);
  const left = slots - cleared;
  const open = slots - Math.min(clearedGold.length, GOLD_RAIDS_PER_WEEK);
  const [done, planned] = [sumTop(clearedGold, GOLD_RAIDS_PER_WEEK), sumTop(plannedGold, open)];
  return {
    slots,
    cleared,
    left,
    possible: done.gold + planned.gold,
    possibleShared: done.shared + planned.shared,
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
        if (run) return { cleared: true, ...runPay(task, run) };
        const planned = c.task_ids.includes(task.id) ? pay(raidGold(c, task) ?? 0, difficultyOf(c, task)) : pay(0);
        return { cleared: false, ...planned };
      };
      if (!task.roster_limited) {
        const all = characters.map(goldOf);
        return [{ possible: all.reduce((sum, r) => sum + r.gold, 0), possibleShared: all.reduce((sum, r) => sum + r.shared, 0), left: 0 }];
      }
      return byAccount(characters).map((roster) => {
        const results = roster.map(goldOf);
        const cleared = results.filter((r) => r.cleared);
        const best = sumTop(cleared.length ? cleared : results, 1);
        return {
          possible: best.gold,
          possibleShared: best.shared,
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

/** The same, counting only gold that isn't character-bound (tradeable + roster-bound). */
export function possibleSharedGold(characters: Character[], tasks: Task[], runs: Run[] = []) {
  const raids = characters.reduce((sum, c) => sum + goldRaidWeek(c, tasks, runs).possibleShared, 0);
  return raids + eventWeeks(characters, tasks, runs).reduce((sum, e) => sum + e.possibleShared, 0);
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
