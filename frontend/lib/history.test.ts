import { describe, expect, it } from "vitest";

import { firstTrackedWeek, missedRaids, weekTone } from "./history";

const week = (paid_raids: number) => ({ week: "2026-09-23", raids: paid_raids, paid_raids, gold: 0 });

describe("weekly history", () => {
  it("grades a gold earner's week against their slots", () => {
    expect(weekTone(week(3), 3, true)).toBe("full");
    expect(weekTone(week(1), 3, true)).toBe("partial");
    expect(weekTone(undefined, 3, true)).toBe("missed");
    expect(weekTone(week(2), 2, true)).toBe("full");
    expect(weekTone(week(0), 3, false)).toBe("none");
    expect(weekTone(week(0), 0, true)).toBe("none");
  });

  it("counts missed gold raids in finished weeks since tracking started", () => {
    expect(missedRaids([week(3), week(1), undefined, week(0)], 3, true)).toBe(0 + 2 + 3);
    // Two weeks before the first clear don't count.
    expect(missedRaids([undefined, week(0), week(2), week(1), week(3)], 3, true)).toBe(1 + 2);
    expect(missedRaids([undefined, undefined], 3, true)).toBe(0);
    expect(missedRaids([week(0), week(0)], 3, false)).toBe(0);
  });

  it("finds the first week with anything recorded", () => {
    expect(firstTrackedWeek([undefined, week(0), week(2)])).toBe(2);
    expect(firstTrackedWeek([{ week: "x", raids: 0, paid_raids: 0, gold: 500 }])).toBe(0);
    expect(firstTrackedWeek([undefined])).toBe(-1);
  });
});
