import { describe, expect, it } from "vitest";

import { canUseBoundGold, defaultPaidFrom, SpendingEntry, spendingBody, totalsSince } from "./spending";

const entry = (extra: Partial<SpendingEntry>): SpendingEntry => ({
  id: 1, category: "honing", amount: 100, paid_from: "bound_first", character_id: null, account_id: null, note: null,
  spent_at: "2026-10-01T12:00:00", ...extra,
});

describe("paid from", () => {
  it("the market only takes tradeable gold", () => {
    expect(defaultPaidFrom("market")).toBe("tradeable");
    expect(canUseBoundGold("market")).toBe(false);
    expect(defaultPaidFrom("honing")).toBe("bound_first");
    expect(canUseBoundGold("gems")).toBe(true);
  });
});

describe("totalsSince", () => {
  it("adds up each category from a date on", () => {
    const entries = [
      entry({ amount: 100 }),
      entry({ amount: 50, category: "market", spent_at: "2026-10-03T00:00:00" }),
      entry({ amount: 7, spent_at: "2026-09-01T00:00:00" }),
    ];
    expect(totalsSince(entries, new Date("2026-09-15T00:00:00Z"))).toEqual({ honing: 100, gems: 0, market: 50, other: 0 });
  });
});

describe("spendingBody", () => {
  it("keeps everything needed to log the entry again", () => {
    expect(spendingBody(entry({ note: "x", character_id: 3 }))).toEqual({
      category: "honing", amount: 100, paid_from: "bound_first", character_id: 3, account_id: null, note: "x",
      spent_at: "2026-10-01T12:00:00",
    });
  });
});
