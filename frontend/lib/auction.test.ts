import { describe, expect, it } from "vitest";

import { auctionBids, auctionFormula } from "./auction";

describe("auctionBids", () => {
  it("accounts for the market fee and the split between the other players", () => {
    // 10,000 × 0.95 × 3/4 = 7,125; ÷ 1.1 = 6,477.
    expect(auctionBids(10_000, 4, true)).toEqual({ breakEven: 7125, recommended: 6477 });
    // 8 players: 10,000 × 0.95 × 7/8 = 8,312.5 → 8,312.
    expect(auctionBids(10_000, 8, true)).toEqual({ breakEven: 8312, recommended: 7556 });
  });

  it("drops the fee for an item you'll use yourself", () => {
    expect(auctionBids(10_000, 4, false).breakEven).toBe(7500);
  });

  it("is zero without a price", () => {
    expect(auctionBids(0, 4, true)).toEqual({ breakEven: 0, recommended: 0 });
    expect(auctionBids(Number.NaN, 8, true)).toEqual({ breakEven: 0, recommended: 0 });
  });

  it("explains itself", () => {
    expect(auctionFormula(10_000, 8, true)).toBe("Break-even = 10,000 × 0.95 (market fee) × 7/8. Recommended = break-even ÷ 1.1.");
  });
});
