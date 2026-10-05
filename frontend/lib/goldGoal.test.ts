import { describe, expect, it } from "vitest";

import { WeeklyGold } from "./api";
import { onHandToward, weeklyToward } from "./goldGoal";

const week = {
  tradeable_left: 100,
  roster_bound_left: 40,
  character_bound: { "7": { earned: 30, spent: 5, left: 25 } },
} as unknown as WeeklyGold;

describe("weeklyToward", () => {
  it("counts the gold each mode allows", () => {
    expect(weeklyToward(week, "tradeable", null)).toBe(100);
    expect(weeklyToward(week, "roster", null)).toBe(140);
    expect(weeklyToward(week, "character", 7)).toBe(165);
    expect(weeklyToward(week, "character", 8)).toBe(140);
    expect(weeklyToward(week, "character", null)).toBe(140);
  });
});

describe("onHandToward", () => {
  it("adds up what's on hand for each mode", () => {
    const onHand = { tradeable: 1000, roster_bound: 300 };
    expect(onHandToward(onHand, "tradeable", 50)).toBe(1000);
    expect(onHandToward(onHand, "roster", 50)).toBe(1300);
    expect(onHandToward(onHand, "character", 50)).toBe(1350);
    expect(onHandToward(onHand, "character", null)).toBe(1300);
    expect(onHandToward(null, "roster", 50)).toBeNull();
  });
});
