import { describe, expect, it } from "vitest";

import { periodTotal, weeksIn } from "./periods";

const weeks = [0, 0, 10, 20, 30, 40, 50, 5];

describe("weeksIn", () => {
  it("covers this week, the last 4, or everything since tracking started", () => {
    expect(weeksIn(weeks, "week", (w) => w === 0)).toEqual([5]);
    expect(weeksIn(weeks, "month", (w) => w === 0)).toEqual([30, 40, 50, 5]);
    expect(weeksIn(weeks, "all", (w) => w === 0)).toEqual([10, 20, 30, 40, 50, 5]);
    expect(weeksIn([0, 0], "all", (w) => w === 0)).toEqual([0]);
  });
});

describe("periodTotal", () => {
  it("adds up a period and averages it per week", () => {
    expect(periodTotal(weeks, "week", (w) => w)).toEqual({ total: 5, weeks: 1, perWeek: 5 });
    expect(periodTotal(weeks, "month", (w) => w)).toEqual({ total: 125, weeks: 4, perWeek: 31.25 });
    expect(periodTotal(weeks, "all", (w) => w)).toEqual({ total: 155, weeks: 6, perWeek: 155 / 6 });
  });
});
