/**
 * Astrogem processing maths for the cutting companion (Tools → Astrogems).
 * Rules and odds come from lib/data/astrogems.ts (sourced, user-editable).
 *
 * The game shows 4 different options each turn, drawn by weight from those
 * that can appear; processing applies one of the 4 at random (25% each); a
 * refresh swaps in a new set of 4. The goal is a finished gem with at least
 * a total of points, and optionally minimum levels for some stats. Once it's
 * met, stopping is best (more attempts can only cost gold or lose a level).
 */

import { ProcessingOption, StatKey } from "./data/astrogems";
import { seededRandom } from "./honing";

export type GemState = {
  levels: Record<StatKey, number>;
  attemptsLeft: number;
  refreshesLeft: number;
  /** Cost modifier: -1 (-100%, free), 0, or 1 (+100%, double). */
  costStep: number;
};

export type Goal = { total: number; min: Partial<Record<StatKey, number>> };

export const STAT_KEYS: StatKey[] = ["willpower", "points", "effect1", "effect2"];

export const total = (state: Pick<GemState, "levels">) => STAT_KEYS.reduce((sum, k) => sum + state.levels[k], 0);

export function goalMet(state: Pick<GemState, "levels">, goal: Goal) {
  return total(state) >= goal.total && STAT_KEYS.every((k) => state.levels[k] >= (goal.min[k] ?? 0));
}

/** Whether an option can be among this turn's 4, per the official conditions. */
export function canAppear(option: ProcessingOption, state: GemState): boolean {
  const e = option.effect;
  const lastAttempt = state.attemptsLeft <= 1;
  switch (e.kind) {
    case "stat": {
      const next = state.levels[e.stat] + e.change;
      return next >= 1 && next <= 5;
    }
    case "cost":
      return !lastAttempt && state.costStep + e.change >= -1 && state.costStep + e.change <= 1;
    case "refresh":
      return !lastAttempt;
    default:
      return option.weight > 0;
  }
}

/** The state after one processing attempt applies `option`. */
export function applyOption(state: GemState, option: ProcessingOption): GemState {
  const next: GemState = { ...state, levels: { ...state.levels }, attemptsLeft: state.attemptsLeft - 1 };
  const e = option.effect;
  if (e.kind === "stat") next.levels[e.stat] = Math.min(5, Math.max(1, next.levels[e.stat] + e.change));
  if (e.kind === "cost") next.costStep = Math.min(1, Math.max(-1, next.costStep + e.change));
  if (e.kind === "refresh") next.refreshesLeft += e.add;
  return next;
}

/** Gold for the next attempt at a base cost. */
export const attemptCost = (state: Pick<GemState, "costStep">, base: number) => Math.max(0, base * (1 + state.costStep));

/** Draw the 4 (or fewer) different options shown this turn, by weight. */
export function drawShown(options: ProcessingOption[], state: GemState, random: () => number, count = 4): ProcessingOption[] {
  const pool = options.filter((o) => o.weight > 0 && canAppear(o, state));
  const shown: ProcessingOption[] = [];
  while (shown.length < count && pool.length) {
    const sum = pool.reduce((s, o) => s + o.weight, 0);
    let target = random() * sum;
    let index = 0;
    while (index < pool.length - 1 && target >= pool[index].weight) target -= pool[index++].weight;
    shown.push(pool.splice(index, 1)[0]);
  }
  return shown;
}

/**
 * Chances to reach the goal, playing well: stop once it's met, otherwise
 * process or refresh, whichever gives the better chance. `beforeShown` is
 * the chance before this turn's options are known; `afterShown` scores a
 * known set of options. The expectation over unknown sets is estimated by
 * sampling sets with a seed fixed per state, so answers are repeatable.
 */
export function createSolver(options: ProcessingOption[], goal: Goal, samples = 96) {
  const memo = new Map<string, number>();
  // Stats with the same odds and the same goal are interchangeable: a gem
  // with 5/1 in them has the same chances as one with 1/5. Grouping them
  // shares the work (up to 24 times less with the built-in odds).
  const signature = (stat: StatKey) =>
    `${goal.min[stat] ?? 0}:` +
    options
      .filter((o) => o.effect.kind === "stat" && o.effect.stat === stat)
      .map((o) => `${o.effect.kind === "stat" ? o.effect.change : 0}=${o.weight}`)
      .sort()
      .join(",");
  const groups = new Map<string, StatKey[]>();
  for (const stat of STAT_KEYS) groups.set(signature(stat), [...(groups.get(signature(stat)) ?? []), stat]);
  const keyOf = (s: GemState) =>
    [...groups.values()].map((stats) => stats.map((k) => s.levels[k]).sort().join("")).join("/") +
    `|${s.attemptsLeft}|${Math.min(s.refreshesLeft, 6)}`;

  function beforeShown(state: GemState): number {
    if (goalMet(state, goal)) return 1;
    if (state.attemptsLeft <= 0) return 0;
    const key = keyOf(state);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    // The cost modifier doesn't change the chance, only gold; fold it out.
    const plain: GemState = { ...state, costStep: 0, refreshesLeft: Math.min(state.refreshesLeft, 6) };
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const random = seededRandom(hash);
    let sum = 0;
    for (let i = 0; i < samples; i++) sum += afterShown(plain, drawShown(options, plain, random)).best;
    const value = sum / samples;
    memo.set(key, value);
    return value;
  }

  /** With the 4 options known: the chance if you process, if you refresh, and the better one. */
  function afterShown(state: GemState, shown: ProcessingOption[]) {
    if (goalMet(state, goal)) return { process: 1, refresh: null as number | null, best: 1, after: shown.map(() => 1) };
    const after = shown.map((o) => beforeShown(applyOption(state, o)));
    const process = after.length ? after.reduce((s, v) => s + v, 0) / after.length : 0;
    const refresh = state.refreshesLeft > 0 ? beforeShown({ ...state, refreshesLeft: state.refreshesLeft - 1 }) : null;
    return { process, refresh, best: Math.max(process, refresh ?? 0), after };
  }

  return { beforeShown, afterShown };
}

export type Advice = {
  action: "stop-done" | "process" | "refresh" | "stop-hopeless";
  /** Chance of reaching the goal if you take the advice. */
  chance: number;
  processChance: number;
  refreshChance: number | null;
  /** For each shown option: the chance of reaching the goal if it's the one applied. */
  after: number[];
};

/** What to do with the options on screen. */
export function advise(solver: ReturnType<typeof createSolver>, state: GemState, shown: ProcessingOption[], goal: Goal, hopeless = 0.005): Advice {
  if (goalMet(state, goal)) return { action: "stop-done", chance: 1, processChance: 1, refreshChance: null, after: shown.map(() => 1) };
  const { process, refresh, after } = solver.afterShown(state, shown);
  const best = Math.max(process, refresh ?? 0);
  const action = best < hopeless ? "stop-hopeless" : refresh !== null && refresh > process + 1e-9 ? "refresh" : "process";
  return { action, chance: best, processChance: process, refreshChance: refresh, after };
}

/**
 * Simulate the rest of the gem following the advice: the chance of reaching
 * the goal and the gold it takes (average and unlucky). Seeded: repeatable.
 */
export function simulateRest(
  solver: ReturnType<typeof createSolver>,
  options: ProcessingOption[],
  start: GemState,
  goal: Goal,
  baseCost: number,
  runs = 2000,
  seed = 77,
) {
  const random = seededRandom(seed);
  const golds: number[] = [];
  let reached = 0;
  for (let r = 0; r < runs; r++) {
    let state = start;
    let gold = 0;
    for (let guard = 0; guard < 60; guard++) {
      if (goalMet(state, goal) || state.attemptsLeft <= 0) break;
      const shown = drawShown(options, state, random);
      const advice = advise(solver, state, shown, goal);
      if (advice.action === "stop-hopeless") break;
      if (advice.action === "refresh") {
        state = { ...state, refreshesLeft: state.refreshesLeft - 1 };
        continue;
      }
      gold += attemptCost(state, baseCost);
      state = applyOption(state, shown[Math.floor(random() * shown.length)]);
    }
    if (goalMet(state, goal)) reached++;
    golds.push(gold);
  }
  golds.sort((a, b) => a - b);
  return {
    chance: reached / runs,
    averageGold: golds.reduce((s, g) => s + g, 0) / runs,
    unluckyGold: golds[Math.floor(0.9 * (runs - 1))] ?? 0,
  };
}

export function resultGrade(points: number, grades: { label: string; min: number }[]) {
  return grades.find((g) => points >= g.min)?.label ?? "";
}
