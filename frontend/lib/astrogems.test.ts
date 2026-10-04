import { describe, expect, it } from "vitest";

import { advise, applyOption, attemptCost, canAppear, createSolver, drawShown, GemState, goalMet, resultGrade, simulateRest, total } from "./astrogems";
import { BUILT_IN_OPTIONS, ProcessingOption, RESULT_GRADES } from "./data/astrogems";
import { seededRandom } from "./honing";

const option = (key: string) => BUILT_IN_OPTIONS.find((o) => o.key === key)!;
const gem = (extra: Partial<GemState> = {}, levels: Partial<GemState["levels"]> = {}): GemState => ({
  levels: { willpower: 1, points: 1, effect1: 1, effect2: 1, ...levels },
  attemptsLeft: 9,
  refreshesLeft: 2,
  costStep: 0,
  ...extra,
});

describe("built-in odds", () => {
  it("add up to 100% like the official table", () => {
    expect(BUILT_IN_OPTIONS.reduce((s, o) => s + o.weight, 0)).toBeCloseTo(100, 9);
    expect(BUILT_IN_OPTIONS).toHaveLength(27);
  });
});

describe("canAppear", () => {
  it("follows the official conditions", () => {
    expect(canAppear(option("willpower+1"), gem({}, { willpower: 5 }))).toBe(false);
    expect(canAppear(option("willpower+2"), gem({}, { willpower: 4 }))).toBe(false);
    expect(canAppear(option("willpower+2"), gem({}, { willpower: 3 }))).toBe(true);
    expect(canAppear(option("willpower+4"), gem({}, { willpower: 2 }))).toBe(false);
    expect(canAppear(option("willpower-1"), gem())).toBe(false);
    expect(canAppear(option("cost+"), gem({ costStep: 1 }))).toBe(false);
    expect(canAppear(option("cost-"), gem({ attemptsLeft: 1 }))).toBe(false);
    expect(canAppear(option("refresh+1"), gem({ attemptsLeft: 1 }))).toBe(false);
    expect(canAppear(option("change1"), gem({ attemptsLeft: 1 }))).toBe(true);
  });
});

describe("applyOption", () => {
  it("changes the gem and uses an attempt", () => {
    const after = applyOption(gem(), option("points+3"));
    expect(after.levels.points).toBe(4);
    expect(after.attemptsLeft).toBe(8);
    expect(applyOption(gem(), option("refresh+2")).refreshesLeft).toBe(4);
    expect(applyOption(gem(), option("cost-")).costStep).toBe(-1);
    expect(applyOption(gem(), option("keep")).levels).toEqual(gem().levels);
  });

  it("costs double, normal or nothing", () => {
    expect(attemptCost(gem({ costStep: 1 }), 900)).toBe(1800);
    expect(attemptCost(gem(), 900)).toBe(900);
    expect(attemptCost(gem({ costStep: -1 }), 900)).toBe(0);
  });
});

describe("drawShown", () => {
  it("shows 4 different options that can appear", () => {
    const random = seededRandom(3);
    for (let i = 0; i < 200; i++) {
      const state = gem({}, { willpower: 5 });
      const shown = drawShown(BUILT_IN_OPTIONS, state, random);
      expect(shown).toHaveLength(4);
      expect(new Set(shown.map((o) => o.key)).size).toBe(4);
      expect(shown.every((o) => canAppear(o, state))).toBe(true);
    }
  });

  it("follows the weights", () => {
    // Two options weighted 3:1, one shown at a time: about 75% / 25%.
    const options: ProcessingOption[] = [
      { key: "a", label: "a", weight: 3, effect: { kind: "keep" } },
      { key: "b", label: "b", weight: 1, effect: { kind: "keep" } },
    ];
    const random = seededRandom(9);
    let a = 0;
    for (let i = 0; i < 4000; i++) if (drawShown(options, gem(), random, 1)[0].key === "a") a++;
    expect(a / 4000).toBeGreaterThan(0.72);
    expect(a / 4000).toBeLessThan(0.78);
  });
});

describe("solver", () => {
  const goal = { total: 16, min: {} };

  it("is certain once the goal is met and hopeless with no attempts", () => {
    const solver = createSolver(BUILT_IN_OPTIONS, goal);
    expect(solver.beforeShown(gem({}, { willpower: 4, points: 4, effect1: 4, effect2: 4 }))).toBe(1);
    expect(solver.beforeShown(gem({ attemptsLeft: 0 }))).toBe(0);
  });

  it("matches a hand calculation on the last attempt", () => {
    // Total 15, one attempt left: only a +N to a stat below 5 reaches 16.
    const solver = createSolver(BUILT_IN_OPTIONS, goal);
    const state = gem({ attemptsLeft: 1, refreshesLeft: 0 }, { willpower: 5, points: 5, effect1: 4, effect2: 1 });
    const shown = [option("effect1+1"), option("effect2-1"), option("keep"), option("change1")];
    const result = solver.afterShown(state, shown);
    // effect2 is at 1, so "effect2 -1" couldn't really appear; the maths still scores what's on screen.
    expect(result.after).toEqual([1, 0, 0, 0]);
    expect(result.process).toBe(0.25);
    expect(result.refresh).toBeNull();
  });

  it("recommends a refresh when the shown options are all bad", () => {
    const solver = createSolver(BUILT_IN_OPTIONS, goal);
    const state = gem({ attemptsLeft: 2, refreshesLeft: 1 }, { willpower: 5, points: 5, effect1: 4, effect2: 1 });
    const bad = [option("keep"), option("change1"), option("change2"), option("effect1-1")];
    const advice = advise(solver, state, bad, goal);
    expect(advice.processChance).toBeLessThan(advice.refreshChance!);
    expect(advice.action).toBe("refresh");
  });

  it("stops a gem that can't reach the goal", () => {
    const solver = createSolver(BUILT_IN_OPTIONS, { total: 20, min: {} });
    const advice = advise(solver, gem({ attemptsLeft: 1, refreshesLeft: 0 }), [option("keep")], { total: 20, min: {} });
    expect(advice.action).toBe("stop-hopeless");
  });

  it("respects minimum levels", () => {
    expect(goalMet(gem({}, { willpower: 5, points: 5, effect1: 5, effect2: 1 }), { total: 16, min: { points: 5 } })).toBe(true);
    expect(goalMet(gem({}, { willpower: 5, points: 4, effect1: 5, effect2: 5 }), { total: 16, min: { points: 5 } })).toBe(false);
  });

  it("gives repeatable odds and gold for the rest of a gem", () => {
    const solver = createSolver(BUILT_IN_OPTIONS, goal, 32);
    const start = gem({ attemptsLeft: 9, refreshesLeft: 2 });
    const first = simulateRest(solver, BUILT_IN_OPTIONS, start, goal, 900, 300);
    expect(simulateRest(solver, BUILT_IN_OPTIONS, start, goal, 900, 300)).toEqual(first);
    expect(first.chance).toBeGreaterThan(0);
    expect(first.chance).toBeLessThan(1);
    expect(first.averageGold).toBeLessThanOrEqual(9 * 1800);
  });
});

describe("helpers", () => {
  it("totals points and names the grade", () => {
    expect(total(gem({}, { willpower: 5, points: 4 }))).toBe(11);
    expect(resultGrade(11, RESULT_GRADES)).toBe("Legendary");
    expect(resultGrade(16, RESULT_GRADES)).toBe("Relic");
    expect(resultGrade(20, RESULT_GRADES)).toBe("Ancient");
  });
});
