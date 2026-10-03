import { describe, expect, it } from "vitest";

describe("usableGold", () => {
  it("leaves out character-bound gold", () => {
    const week = { tradeable_left: 100, roster_bound_left: 40, character_bound_left: 500 } as WeeklyGold;
    expect(usableGold(week)).toBe(140);
  });
});

import { combineGems, errorMessage, formatCombinedGems, gemsToLv1, parseUtc, usableGold, WeeklyGold } from "./api";
import { isNewer } from "./version";

describe("gemsToLv1", () => {
  it("counts each level as three of the one below", () => {
    expect(gemsToLv1({ "1": 3, "2": 1, "3": 1 })).toBe(3 + 3 + 9);
    expect(gemsToLv1({ "2": 22 })).toBe(66);
    expect(gemsToLv1(null)).toBe(0);
  });
});

describe("parseUtc", () => {
  it("treats the API's naive datetimes as UTC", () => {
    expect(parseUtc("2026-10-07T10:00:00").toISOString()).toBe("2026-10-07T10:00:00.000Z");
    expect(parseUtc("2026-10-07T10:00:00Z").toISOString()).toBe("2026-10-07T10:00:00.000Z");
  });
});

describe("isNewer", () => {
  it("compares versions numerically", () => {
    expect(isNewer("1.10.0", "1.9.2")).toBe(true);
    expect(isNewer("1.4.0", "1.4.0")).toBe(false);
    expect(isNewer("1.3.9", "1.4.0")).toBe(false);
    expect(isNewer("2.0", "1.9.9")).toBe(true);
  });
});

describe("errorMessage", () => {
  it("reads FastAPI's string and validation-list details", () => {
    expect(errorMessage("Task not found")).toBe("Task not found");
    expect(errorMessage([{ msg: "Input should be greater than 0" }, { msg: "Field required" }])).toBe(
      "Input should be greater than 0; Field required",
    );
    expect(errorMessage(undefined)).toBeNull();
  });
});

describe("combineGems", () => {
  it("combines three of a level into one of the next", () => {
    expect(formatCombinedGems(3)).toBe("Lv2");
    expect(formatCombinedGems(15)).toBe("Lv3 + 2× Lv2");
    expect(formatCombinedGems(27 + 9 + 2)).toBe("Lv4 + Lv3 + 2× Lv1");
    expect(formatCombinedGems(132)).toBe("Lv5 + Lv4 + 2× Lv3 + 2× Lv2"); // 81 + 27 + 18 + 6
    expect(formatCombinedGems(4.5)).toBe("Lv2 + 1.5× Lv1");
    expect(formatCombinedGems(0)).toBe("None");
  });

  it("matches the Lv1 equivalent it came from", () => {
    const total = combineGems(1000).reduce((sum, { level, count }) => sum + count * 3 ** (level - 1), 0);
    expect(total).toBe(1000);
  });
});
