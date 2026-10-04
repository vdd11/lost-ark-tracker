import { describe, expect, it } from "vitest";

import {
  attemptDistribution,
  attemptsAtPercentile,
  averageIncome,
  expectedAttempts,
  goalProgress,
  forecastPlan,
  HoningStep,
  newStep,
  seededRandom,
  weeksToAfford,
} from "./honing";

const step = (extra: Partial<HoningStep>): HoningStep => ({ ...newStep("s"), ...extra });

describe("attemptDistribution", () => {
  it("a flat 50% chance halves each attempt", () => {
    const d = attemptDistribution(step({ chance: 50 }));
    expect(d.slice(0, 3)).toEqual([0.5, 0.25, 0.125]);
    expect(expectedAttempts(d)).toBeCloseTo(2, 6);
  });

  it("follows a rising chance and a guarantee exactly", () => {
    // 10%, then 20%, then guaranteed: 0.1, 0.9 × 0.2 = 0.18, 0.9 × 0.8 = 0.72.
    const d = attemptDistribution(step({ chance: 10, chanceStep: 10, guaranteedBy: 3 }));
    expect(d).toHaveLength(3);
    expect(d[0]).toBeCloseTo(0.1, 12);
    expect(d[1]).toBeCloseTo(0.18, 12);
    expect(d[2]).toBeCloseTo(0.72, 12);
    expect(expectedAttempts(d)).toBeCloseTo(0.1 + 0.36 + 2.16, 12);
  });

  it("stops the chance at its cap", () => {
    // 30%, then +30 capped at 40%: 0.3, 0.7 × 0.4 = 0.28, 0.42 × 0.4 = 0.168.
    const d = attemptDistribution(step({ chance: 30, chanceStep: 30, chanceCap: 40 }));
    expect(d[1]).toBeCloseTo(0.28, 12);
    expect(d[2]).toBeCloseTo(0.168, 12);
  });

  it("is certain at 100% and impossible at 0% without a guarantee", () => {
    expect(attemptDistribution(step({ chance: 100 }))).toEqual([1]);
    expect(attemptDistribution(step({ chance: 0 }))).toEqual([]);
    expect(attemptDistribution(step({ chance: 0, chanceStep: 5, chanceCap: 0 }))).toEqual([]);
    expect(attemptDistribution(step({ chance: 0, guaranteedBy: 4 }))).toEqual([0, 0, 0, 1]);
  });
});

describe("attemptsAtPercentile", () => {
  it("finds how many attempts cover a probability", () => {
    const d = attemptDistribution(step({ chance: 50 }));
    expect(attemptsAtPercentile(d, 0.5)).toBe(1);
    expect(attemptsAtPercentile(d, 0.75)).toBe(2);
    expect(attemptsAtPercentile(d, 0.9)).toBe(4);
  });
});

describe("seededRandom", () => {
  it("repeats for the same seed", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("forecastPlan", () => {
  it("is exact when every attempt succeeds, and subtracts owned materials", () => {
    const plan = {
      steps: [step({ id: "a", count: 3, materials: { stone: 100, leap: 5 }, gold: 1000, silver: 50000 })],
      owned: { stone: 250 },
    };
    const forecast = forecastPlan(plan, { stone: 2, leap: 40 }, 200);
    // 300 stones (250 owned, 50 bought at 2) + 15 leapstones at 40 = 100 + 600; fees 3 × 1000.
    expect(forecast.median).toEqual({ buyGold: 700, feeGold: 3000, total: 3700, silver: 150000 });
    expect(forecast.lucky).toEqual(forecast.median);
    expect(forecast.unlucky).toEqual(forecast.median);
    expect(forecast.averageMaterials).toEqual({ stone: 300, leap: 15 });
    expect(forecast.unpriced).toEqual([]);
  });

  it("spreads costs for chancy steps, repeatably", () => {
    const plan = { steps: [step({ id: "a", count: 2, chance: 30, chanceStep: 3, guaranteedBy: 8, gold: 100 })], owned: {} };
    const first = forecastPlan(plan, {}, 5000);
    const again = forecastPlan(plan, {}, 5000);
    expect(again).toEqual(first);
    expect(first.lucky.total).toBeLessThanOrEqual(first.median.total);
    expect(first.median.total).toBeLessThanOrEqual(first.unlucky.total);
    // The simulated average matches the exact expectation closely.
    const exact = 2 * expectedAttempts(attemptDistribution(plan.steps[0])) * 100;
    expect(first.expected[0].attempts * 2 * 100).toBeCloseTo(exact, 6);
    expect(first.unlucky.total).toBeLessThanOrEqual(2 * 8 * 100);
  });

  it("lists materials without a price and doesn't count them", () => {
    const plan = { steps: [step({ id: "a", materials: { stone: 10, mystery: 2 } })], owned: {} };
    const forecast = forecastPlan(plan, { stone: 1 }, 10);
    expect(forecast.unpriced).toEqual(["mystery"]);
    expect(forecast.median.buyGold).toBe(10);
  });

  it("flags steps that can never succeed", () => {
    const forecast = forecastPlan({ steps: [step({ id: "x", chance: 0 })], owned: {} }, {}, 10);
    expect(forecast.expected[0].neverSucceeds).toBe(true);
    expect(forecast.median.total).toBe(0);
  });
});

describe("weeksToAfford", () => {
  const income = { tradeable: 10000, rosterBound: 20000, characterBound: 5000 };

  it("needs tradeable gold for materials and any allowed gold for fees", () => {
    // Materials 30k tradeable at 10k/week = 3 weeks; everything 90k at 30k/week = 3 weeks.
    expect(weeksToAfford({ buyGold: 30000, feeGold: 60000 }, income, "roster")).toBe(3);
    // Fees heavier: 120k at 30k/week = 4 weeks.
    expect(weeksToAfford({ buyGold: 10000, feeGold: 110000 }, income, "roster")).toBe(4);
    // Counting this character's bound gold too: 120k at 35k/week.
    expect(weeksToAfford({ buyGold: 10000, feeGold: 110000 }, income, "all")).toBeCloseTo(120000 / 35000, 9);
    // Tradeable only: 120k at 10k/week.
    expect(weeksToAfford({ buyGold: 10000, feeGold: 110000 }, income, "tradeable")).toBe(12);
  });

  it("uses gold on hand first and extra weekly gold", () => {
    const onHand = { tradeable: 30000, rosterBound: 30000, characterBound: 0 };
    expect(weeksToAfford({ buyGold: 30000, feeGold: 30000 }, income, "roster", onHand)).toBe(0);
    expect(weeksToAfford({ buyGold: 40000, feeGold: 0 }, income, "roster", undefined, 10000)).toBe(2);
  });

  it("is null when the income can't pay for it", () => {
    expect(weeksToAfford({ buyGold: 1000, feeGold: 0 }, { tradeable: 0, rosterBound: 5000, characterBound: 0 }, "roster")).toBeNull();
  });
});

describe("averageIncome", () => {
  it("averages finished weeks only", () => {
    const week = (t: number, r: number, c: number) => ({ tradeable_left: t, roster_bound_left: r, character_bound: { "7": { left: c } } });
    const income = averageIncome([week(100, 10, 1), week(300, 30, 3), week(999, 999, 999)], 7);
    expect(income).toEqual({ tradeable: 200, rosterBound: 20, characterBound: 2 });
    expect(averageIncome([week(1, 1, 1)], 7)).toEqual({ tradeable: 0, rosterBound: 0, characterBound: 0 });
  });
});

describe("goalProgress", () => {
  const goal = { character_id: 1, start_item_level: 1700, target_item_level: 1720 };
  it("measures from the plan's start to its target", () => {
    expect(goalProgress(1700, goal)).toBe(0);
    expect(goalProgress(1710, goal)).toBe(0.5);
    expect(goalProgress(1725, goal)).toBe(1);
    expect(goalProgress(1690, goal)).toBe(0);
  });
  it("has nothing to show without a target above the start", () => {
    expect(goalProgress(1700, { ...goal, target_item_level: null })).toBeNull();
    expect(goalProgress(1690, { ...goal, target_item_level: 1695 })).toBeNull();
  });
});
