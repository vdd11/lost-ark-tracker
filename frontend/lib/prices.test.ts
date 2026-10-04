import { describe, expect, it } from "vitest";

import { formatUnitPrice, parsePrice, Price, priceAge, valueAt } from "./prices";

const price = (key: string, unit: number | null, name = key): Price => ({
  key, name, price: unit, per: 1, unit_price: unit, hidden: false, builtin: true, tools: [], updated_at: null,
});

describe("parsePrice", () => {
  it("reads plain, thousands and decimal-comma numbers", () => {
    expect(parsePrice("250")).toBe(250);
    expect(parsePrice("1,234")).toBe(1234);
    expect(parsePrice("1,234.5")).toBe(1234.5);
    expect(parsePrice("0,8")).toBe(0.8);
    expect(parsePrice(" 12 ")).toBe(12);
  });

  it("is null for empty, negative or junk input", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("-3")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
  });
});

describe("priceAge", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("says how old a price is and flags old ones", () => {
    expect(priceAge("2026-10-10T08:00:00", now)).toEqual({ text: "today", stale: false });
    expect(priceAge("2026-10-09T08:00:00", now)).toEqual({ text: "yesterday", stale: false });
    expect(priceAge("2026-10-03T08:00:00", now)).toEqual({ text: "7 days ago", stale: true });
    expect(priceAge(null, now)).toBeNull();
  });
});

describe("valueAt", () => {
  it("adds up priced materials and lists unpriced ones", () => {
    const prices = [price("stone", 2.5), price("leap", 40), price("fusion", null, "Fusion")];
    expect(valueAt({ stone: 100, leap: 3, fusion: 5, other: 0 }, prices)).toEqual({ gold: 370, missing: ["Fusion"] });
  });
});

describe("formatUnitPrice", () => {
  it("rounds big prices and keeps small ones precise", () => {
    expect(formatUnitPrice(1234.6)).toBe((1235).toLocaleString());
    expect(formatUnitPrice(0.833)).toBe((0.83).toLocaleString());
  });
});
