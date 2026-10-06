import { describe, expect, it } from "vitest";

import { Difficulty, Task } from "./api";
import { raidInfoRows } from "./raidInfo";

const d = (name: string, min_item_level: number, gold: number | null, extra: Partial<Difficulty> = {}) =>
  ({ id: min_item_level, name, min_item_level, gold, bound_percent: 0, bound_kind: "roster", bonus_cost: null, ...extra }) as Difficulty;

describe("raidInfoRows", () => {
  it("lists each difficulty's item level, gold, bound split and bonus cost, easiest first", () => {
    const serca = {
      name: "Serca",
      difficulties: [d("Hard", 1730, 44000, { bonus_cost: 14080 }), d("Normal", 1710, 32000, { bound_percent: 50, bonus_cost: 11200 })],
    } as Task;
    expect(raidInfoRows(serca)).toEqual([
      { difficulty: "Normal", itemLevel: "1710", gold: "32,000", bound: "50% roster", bonus: "11,200" },
      { difficulty: "Hard", itemLevel: "1730", gold: "44,000", bound: "–", bonus: "14,080" },
    ]);
  });

  it("shows ? for values nobody knows yet", () => {
    expect(raidInfoRows({ name: "New", difficulties: [d("Normal", 1760, null)] } as Task)[0]).toMatchObject({ gold: "?", bonus: "?" });
  });
});
