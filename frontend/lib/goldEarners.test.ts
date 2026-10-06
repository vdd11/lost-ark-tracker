import { describe, expect, it } from "vitest";

import { Account, Character } from "./api";
import { canBecomeEarner, goldEarnerCounts, goldThisWeek, goldThisWeekParts, raidGoldSplit } from "./goldEarners";

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

describe("raidGoldSplit", () => {
  it("separates character-bound gold and counts who has it", () => {
    const week = {
      raid_gold: 146800,
      character_bound_gold: 46800,
      character_bound: { "1": { earned: 30000, spent: 0, left: 30000 }, "2": { earned: 16800, spent: 0, left: 16800 }, "3": { earned: 0, spent: 0, left: 0 } },
    };
    expect(raidGoldSplit(week)).toEqual({ shared: 100000, characterBound: 46800, spreadOver: 2 });
  });
});

describe("goldThisWeek", () => {
  it("is tradeable + roster-bound gold after the bonus boxes those paid for", () => {
    // 214,000 raid gold, 100,000 of it character-bound; 12,500 logged; 10,240 of boxes came out of shared gold.
    const week = { raid_gold: 214000, character_bound_gold: 100000, other_gold: 12500, tradeable_left: 96260, roster_bound_left: 20000 };
    const gold = goldThisWeek(week);
    expect(gold).toEqual({ total: 116260, raid: 114000, other: 12500, bonus: 10240 });
    expect(goldThisWeekParts(gold, (n) => n.toLocaleString("en-US"))).toBe("raid 114,000 · other 12,500 · bonus −10,240");
  });

  it("leaves out the parts that are zero", () => {
    const gold = goldThisWeek({ raid_gold: 0, character_bound_gold: 0, other_gold: 5000, tradeable_left: 5000, roster_bound_left: 0 });
    expect(goldThisWeekParts(gold, String)).toBe("other 5000");
    expect(goldThisWeekParts({ raid: 0, other: 0, bonus: 0 }, String)).toBe("");
  });
});
