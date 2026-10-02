import { describe, expect, it } from "vitest";

import { gemsToLv1, parseUtc } from "./api";
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
