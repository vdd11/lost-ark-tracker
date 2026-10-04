/**
 * Honing planner maths. No game numbers live here: every chance and cost
 * comes from what the user copies off their in-game honing panel, because
 * honing was reworked in 2026 and fixed per-failure formulas from older
 * guides no longer hold (see the Guides page for current calculators).
 *
 * A step is one kind of upgrade ("armor +14 to +15") done `count` times. Its
 * attempts follow the chances the user entered: a base chance, optionally
 * rising by `chanceStep` points after each failure (up to `chanceCap`), and
 * optionally guaranteed by attempt `guaranteedBy`.
 */

export type HoningStep = {
  id: string;
  label: string;
  /** How many times this upgrade is done (e.g. 5 armor pieces). */
  count: number;
  /** Success chance of the first attempt, in percent. */
  chance: number;
  /** Percentage points added after each failure (0 if the panel shows none). */
  chanceStep: number;
  /** Highest the chance can climb to, in percent; null for no limit. */
  chanceCap: number | null;
  /** The attempt that always succeeds (pity), if the game shows one. */
  guaranteedBy: number | null;
  /** Price key (Tools → Prices) -> amount used per attempt. */
  materials: Record<string, number>;
  /** Gold fee per attempt. */
  gold: number;
  silver: number;
};

export type HoningPlan = {
  steps: HoningStep[];
  /** Price key -> amount the user already has. */
  owned: Record<string, number>;
};

/** Gold per unit by price key; missing or null means no price set. */
export type UnitPrices = Record<string, number | null | undefined>;

const MAX_ATTEMPTS = 1000;
const TAIL = 1e-12;

/**
 * Exact chance that the upgrade first succeeds on attempt 1, 2, 3, ...
 * (index 0 is attempt 1). Ends at the guaranteed attempt, or once what's
 * left is negligible. Zero chance and no guarantee can never succeed: [].
 */
export function attemptDistribution(step: Pick<HoningStep, "chance" | "chanceStep" | "chanceCap" | "guaranteedBy">): number[] {
  const cap = Math.min(100, step.chanceCap ?? 100);
  const result: number[] = [];
  let stillFailing = 1;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const guaranteed = step.guaranteedBy != null && attempt >= step.guaranteedBy;
    const percent = guaranteed ? 100 : Math.min(cap, Math.max(0, step.chance + step.chanceStep * (attempt - 1)));
    const p = percent / 100;
    result.push(stillFailing * p);
    stillFailing *= 1 - p;
    if (stillFailing < TAIL) break;
    if (step.guaranteedBy == null && p === 0 && step.chanceStep <= 0) return [];
  }
  // Still mostly failing after MAX_ATTEMPTS: too unlikely to plan around.
  return stillFailing > 0.001 ? [] : result;
}

export function expectedAttempts(distribution: number[]): number {
  return distribution.reduce((sum, p, i) => sum + p * (i + 1), 0);
}

/** The fewest attempts that succeed with at least probability q (0..1). */
export function attemptsAtPercentile(distribution: number[], q: number): number {
  let cumulative = 0;
  for (let i = 0; i < distribution.length; i++) {
    cumulative += distribution[i];
    if (cumulative >= q - 1e-12) return i + 1;
  }
  return distribution.length;
}

/** A small seeded random number generator (mulberry32), so results repeat exactly. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cumulative(distribution: number[]) {
  const sums: number[] = [];
  let total = 0;
  for (const p of distribution) sums.push((total += p));
  return sums;
}

function draw(cdf: number[], random: () => number) {
  const target = random() * cdf[cdf.length - 1];
  let low = 0;
  let high = cdf.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (cdf[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low + 1;
}

export type CostSummary = {
  /** Gold to buy the materials you don't own, at your prices (tradeable gold). */
  buyGold: number;
  /** Gold fees for the attempts. */
  feeGold: number;
  total: number;
  silver: number;
};

export type PlanForecast = {
  /** Each step's expected attempts per upgrade. */
  expected: { id: string; attempts: number; neverSucceeds: boolean }[];
  /** Good luck (10th percentile), typical (median) and unlucky (90th percentile) total cost. */
  lucky: CostSummary;
  median: CostSummary;
  unlucky: CostSummary;
  /** Average materials needed in total, by price key. */
  averageMaterials: Record<string, number>;
  /** Materials used without a price: their cost isn't counted. */
  unpriced: string[];
  samples: number;
};

function sortedPick<T>(items: T[], key: (item: T) => number, q: number): T {
  const sorted = [...items].sort((a, b) => key(a) - key(b));
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}

/**
 * What the plan costs, as a spread rather than one average: simulated with a
 * fixed seed (the same plan always gives the same numbers). Owned materials
 * are used first and cost nothing; the rest is bought at the user's prices.
 */
export function forecastPlan(plan: HoningPlan, prices: UnitPrices, samples = 10000, seed = 1740): PlanForecast {
  const steps = plan.steps.filter((s) => s.count > 0);
  const distributions = steps.map((s) => attemptDistribution(s));
  const expected = steps.map((s, i) => ({
    id: s.id,
    attempts: expectedAttempts(distributions[i]),
    neverSucceeds: distributions[i].length === 0,
  }));
  const usable = steps.map((s, i) => ({ step: s, cdf: cumulative(distributions[i]) })).filter((s) => s.cdf.length > 0);
  const keys = [...new Set(usable.flatMap(({ step }) => Object.keys(step.materials).filter((k) => step.materials[k] > 0)))];
  const unpriced = keys.filter((k) => prices[k] == null);

  const random = seededRandom(seed);
  const outcomes: (CostSummary & { materials: Record<string, number> })[] = [];
  const totals: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (let n = 0; n < samples; n++) {
    const used: Record<string, number> = {};
    let feeGold = 0;
    let silver = 0;
    for (const { step, cdf } of usable) {
      for (let c = 0; c < step.count; c++) {
        const attempts = draw(cdf, random);
        feeGold += attempts * step.gold;
        silver += attempts * step.silver;
        for (const key of keys) used[key] = (used[key] ?? 0) + attempts * (step.materials[key] ?? 0);
      }
    }
    let buyGold = 0;
    for (const key of keys) {
      totals[key] += used[key];
      const price = prices[key];
      if (price != null) buyGold += Math.max(0, used[key] - (plan.owned[key] ?? 0)) * price;
    }
    outcomes.push({ buyGold, feeGold, total: buyGold + feeGold, silver, materials: used });
  }

  const pick = (q: number): CostSummary => {
    if (!outcomes.length) return { buyGold: 0, feeGold: 0, total: 0, silver: 0 };
    const { buyGold, feeGold, total, silver } = sortedPick(outcomes, (o) => o.total, q);
    return { buyGold, feeGold, total, silver };
  };
  return {
    expected,
    lucky: pick(0.1),
    median: pick(0.5),
    unlucky: pick(0.9),
    averageMaterials: Object.fromEntries(keys.map((k) => [k, samples ? totals[k] / samples : 0])),
    unpriced,
    samples,
  };
}

/** Which gold can pay for honing: the user's choice, shown on screen. */
export type BoundMode = "tradeable" | "roster" | "all";

export const BOUND_MODES: { key: BoundMode; label: string }[] = [
  { key: "tradeable", label: "Tradeable gold only" },
  { key: "roster", label: "Tradeable + roster-bound" },
  { key: "all", label: "Tradeable + roster-bound + this character's bound gold" },
];

export type WeeklyIncome = { tradeable: number; rosterBound: number; characterBound: number };

/**
 * Weeks until the plan is paid for, at a weekly income. Materials have to be
 * bought with tradeable gold; fees can use whatever `mode` allows. Gold
 * already on hand counts first (tradeable toward materials). Null if the
 * income can never cover it.
 */
export function weeksToAfford(
  cost: Pick<CostSummary, "buyGold" | "feeGold">,
  income: WeeklyIncome,
  mode: BoundMode,
  onHand: WeeklyIncome = { tradeable: 0, rosterBound: 0, characterBound: 0 },
  extraWeekly = 0,
): number | null {
  const pool = (i: WeeklyIncome) =>
    i.tradeable + (mode === "tradeable" ? 0 : i.rosterBound) + (mode === "all" ? i.characterBound : 0);
  const tradeableNeed = Math.max(0, cost.buyGold - onHand.tradeable);
  const totalNeed = Math.max(0, cost.buyGold + cost.feeGold - pool(onHand));
  const tradeableWeekly = income.tradeable + extraWeekly;
  const poolWeekly = pool(income) + extraWeekly;
  const weeks = (need: number, weekly: number) => (need <= 0 ? 0 : weekly > 0 ? need / weekly : Infinity);
  const result = Math.max(weeks(tradeableNeed, tradeableWeekly), weeks(totalNeed, poolWeekly));
  return Number.isFinite(result) ? result : null;
}

/** Average weekly income from finished weeks (the current one isn't over). */
export function averageIncome(
  weeks: { tradeable_left: number; roster_bound_left: number; character_bound: Record<string, { left: number }> }[],
  characterId: number | null,
): WeeklyIncome {
  const finished = weeks.slice(0, -1);
  if (!finished.length) return { tradeable: 0, rosterBound: 0, characterBound: 0 };
  const average = (value: (w: (typeof finished)[number]) => number) => finished.reduce((sum, w) => sum + value(w), 0) / finished.length;
  return {
    tradeable: average((w) => w.tradeable_left),
    rosterBound: average((w) => w.roster_bound_left),
    characterBound: characterId == null ? 0 : average((w) => w.character_bound[String(characterId)]?.left ?? 0),
  };
}

/** A saved plan's goal, as the tracker shows it under a character. */
export type HoningGoal = { character_id: number; start_item_level: number; target_item_level: number | null };

/**
 * How far a character is from where their plan started to its target, 0..1,
 * or null without a target above the start.
 */
export function goalProgress(itemLevel: number, goal: HoningGoal): number | null {
  const target = goal.target_item_level;
  if (target == null) return null;
  if (itemLevel >= target) return 1;
  if (target <= goal.start_item_level) return null;
  return Math.max(0, Math.min(1, (itemLevel - goal.start_item_level) / (target - goal.start_item_level)));
}

export function newStep(id: string): HoningStep {
  return { id, label: "", count: 1, chance: 100, chanceStep: 0, chanceCap: null, guaranteedBy: null, materials: {}, gold: 0, silver: 0 };
}
