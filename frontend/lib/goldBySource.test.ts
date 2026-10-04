import { describe, expect, it } from "vitest";

import { WeeklyGold } from "./api";
import { goldBySource } from "./goldBySource";

const week = (raid: number, bySource: Record<string, number>): WeeklyGold =>
  ({ week: "2026-09-30", raid_gold: raid, by_source: bySource } as unknown as WeeklyGold);

describe("goldBySource", () => {
  it("totals each source for this week, the last four weeks and on average", () => {
    const weeks = [
      week(100, { "Chaos Gate": 10 }),
      week(100, {}),
      week(200, { "Chaos Gate": 20, "Field Boss": 5 }),
      week(300, {}),
      week(400, { "Chaos Gate": 30 }),
      week(50, { "Field Boss": 7 }), // this week, still going
    ];
    expect(goldBySource(weeks)).toEqual([
      { source: "Raids", thisWeek: 50, lastFour: 1000, average: 220 },
      { source: "Chaos Gate", thisWeek: 0, lastFour: 50, average: 12 },
      { source: "Field Boss", thisWeek: 7, lastFour: 5, average: 1 },
    ]);
  });

  it("leaves out sources with nothing and copes with no weeks", () => {
    expect(goldBySource([week(0, { Other: 0 })])).toEqual([]);
    expect(goldBySource([])).toEqual([]);
  });
});
