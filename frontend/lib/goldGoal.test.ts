import { describe, expect, it } from "vitest";

import { WeeklyGold } from "./api";
import { onHandToward, weeklyToward } from "./goldGoal";

const week = { tradeable_left: 100, roster_bound_left: 40 } as unknown as WeeklyGold;

describe("weeklyToward", () => {
  it("counts tradeable gold, plus roster-bound if the mode allows", () => {
    expect(weeklyToward(week, "tradeable")).toBe(100);
    expect(weeklyToward(week, "roster")).toBe(140);
  });
});

describe("onHandToward", () => {
  it("adds up what's on hand for each mode", () => {
    const onHand = { tradeable: 1000, roster_bound: 300 };
    expect(onHandToward(onHand, "tradeable")).toBe(1000);
    expect(onHandToward(onHand, "roster")).toBe(1300);
    expect(onHandToward(null, "roster")).toBeNull();
  });
});
