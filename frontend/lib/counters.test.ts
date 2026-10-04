import { describe, expect, it } from "vitest";

import { Counter, counterProgress, countersFor } from "./counters";

const counter = (extra: Partial<Counter>): Counter => ({
  id: 1, name: "Seeds", value: 0, target: null, character_id: null, account_id: null, position: 0, ...extra,
});

describe("countersFor", () => {
  it("shows an account's counters plus the shared ones", () => {
    const shared = counter({ id: 1 });
    const main = counter({ id: 2, account_id: 1 });
    const alt = counter({ id: 3, account_id: 2 });
    expect(countersFor([shared, main, alt], 1)).toEqual([shared, main]);
    expect(countersFor([shared, main, alt], 0)).toEqual([shared, main, alt]);
  });
});

describe("counterProgress", () => {
  it("is the share of the target, capped at 1", () => {
    expect(counterProgress(counter({ value: 30, target: 120 }))).toBe(0.25);
    expect(counterProgress(counter({ value: 200, target: 120 }))).toBe(1);
    expect(counterProgress(counter({ value: 5 }))).toBeNull();
  });
});
