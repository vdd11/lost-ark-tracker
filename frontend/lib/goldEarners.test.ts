import { describe, expect, it } from "vitest";

import { Account, Character } from "./api";
import { canBecomeEarner, goldEarnerCounts, goldThisWeek } from "./goldEarners";

const account = (id: number, name: string) => ({ id, name, position: id, characters: 0 }) as Account;
const character = (id: number, accountId: number, earner: boolean) => ({ id, name: `C${id}`, account_id: accountId, is_gold_earner: earner }) as Character;

describe("goldEarnerCounts", () => {
  it("counts earners per account and flags full ones", () => {
    const roster = [
      ...Array.from({ length: 6 }, (_, i) => character(i + 1, 1, true)),
      character(7, 1, false),
      character(8, 2, true),
    ];
    const counts = goldEarnerCounts(roster, [account(1, "Main"), account(2, "Alt"), account(3, "Empty")]);
    expect(counts.map((c) => [c.account.name, c.earners, c.characters, c.max, c.full])).toEqual([
      ["Main", 6, 7, 6, true],
      ["Alt", 1, 1, 6, false],
    ]);
  });
});

describe("canBecomeEarner", () => {
  it("needs a free slot on the character's own account", () => {
    const full = Array.from({ length: 6 }, (_, i) => character(i + 1, 1, true));
    const spare = character(7, 1, false);
    const other = character(8, 2, false);
    expect(canBecomeEarner(spare, [...full, spare, other])).toBe(false);
    expect(canBecomeEarner(other, [...full, spare, other])).toBe(true);
    expect(canBecomeEarner(full[0], full)).toBe(true);
  });
});

describe("goldThisWeek", () => {
  it("is tradeable + roster-bound gold after the bonus boxes those paid for, raids and other", () => {
    // 214,000 raid gold, 100,000 of it character-bound; 12,500 logged; 10,240 of boxes came out of shared gold.
    const week = { other_gold: 12500, tradeable_left: 96260, roster_bound_left: 20000 };
    expect(goldThisWeek(week)).toEqual({ total: 116260, raids: 103760, other: 12500 });
  });

  it("never shows negative raid gold", () => {
    expect(goldThisWeek({ other_gold: 5000, tradeable_left: 3000, roster_bound_left: 0 })).toEqual({ total: 3000, raids: 0, other: 5000 });
  });
});
