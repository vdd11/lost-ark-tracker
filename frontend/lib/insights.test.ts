import { describe, expect, it } from "vitest";

import { compactGold, dailyRate, daysToGoal, formatDuration, gemGoal, percentChange } from "./insights";

describe("dailyRate", () => {
  it("averages recent finished weeks plus this week's days", () => {
    // Four full weeks of 70 and 3.5 days into this week with 35: 315 over 31.5 days.
    expect(dailyRate([0, 70, 70, 70, 70, 35], 3.5)).toBeCloseTo(10);
  });

  it("ignores the weeks before tracking started", () => {
    expect(dailyRate([0, 0, 0, 0, 140, 70], 7)).toBeCloseTo(15);
  });

  it("needs at least a day of data", () => {
    expect(dailyRate([0, 0, 0], 3)).toBeNull();
    expect(dailyRate([50], 0.5)).toBeNull();
  });
});

describe("gemGoal", () => {
  it("counts progress toward the next gem of a level", () => {
    // A Lv9 is 3^8 = 6561 Lv1s.
    const goal = gemGoal(6561 + 3280.5, 100, 9);
    expect(goal.size).toBe(6561);
    expect(goal.earned).toBe(1);
    expect(goal.progress).toBeCloseTo(0.5);
    expect(goal.days).toBeCloseTo(32.805);
    expect(goal.every).toBeCloseTo(65.61);
  });

  it("has no ETA without a pace", () => {
    expect(gemGoal(10, null, 10).days).toBeNull();
  });
});

describe("gold goals", () => {
  it("projects time to a target", () => {
    expect(daysToGoal(400_000, 1_000_000, 20_000)).toBe(30);
    expect(daysToGoal(1_200_000, 1_000_000, 0)).toBe(0);
    expect(daysToGoal(0, 1_000_000, null)).toBeNull();
  });

  it("compares periods", () => {
    expect(percentChange(100, 112)).toBe(12);
    expect(percentChange(0, 50)).toBeNull();
  });
});

describe("formatting", () => {
  it("reads durations naturally", () => {
    expect(formatDuration(0.5)).toBe("under a day");
    expect(formatDuration(1)).toBe("1 day");
    expect(formatDuration(9.4)).toBe("9 days");
    expect(formatDuration(35)).toBe("5 weeks");
    expect(formatDuration(120)).toBe("4 months");
    expect(formatDuration(548)).toBe("1.5 years");
  });

  it("shortens gold", () => {
    expect(compactGold(812_500)).toBe("812.5k");
    expect(compactGold(1_250_000)).toBe("1.25M");
    expect(compactGold(950)).toBe("950");
  });
});
