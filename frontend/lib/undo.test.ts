import { describe, expect, it } from "vitest";

import { BalanceCheck, GoldEntry, Run } from "./api";
import { checkInBody, goldEntryBody, restoreRunBody } from "./undo";

const run = (extra: Partial<Run>): Run => ({
  character_id: 1, task_id: 2, difficulty_id: 30, count: 1, lucky_rooms: 0, mega_rooms: 0, sands: 0,
  bought_bonus: false, bonus_spent: 0, tier_counts: null, gems: null, ...extra,
});

describe("restoreRunBody", () => {
  it("brings back the difficulty and only the details that were set", () => {
    expect(restoreRunBody(run({}))).toEqual({ difficulty_id: 30 });
    expect(restoreRunBody(run({ bought_bonus: true, sands: 3, lucky_rooms: 1 }))).toEqual({
      difficulty_id: 30, bought_bonus: true, sands: 3, lucky_rooms: 1,
    });
  });

  it("restores run counts per tier for counted content", () => {
    expect(restoreRunBody(run({ count: 3, tier_counts: { "30": 2, "31": 1 } }))).toEqual({
      difficulty_id: 30, tier_counts: { "30": 2, "31": 1 },
    });
    expect(restoreRunBody(run({ count: 2 }))).toEqual({ difficulty_id: 30, count: 2 });
  });
});

describe("recreating deleted rows", () => {
  it("keeps a gold entry's date, owner and note", () => {
    const entry: GoldEntry = {
      id: 9, source: "Trade", amount: 500, character_id: null, account_id: 2, note: "sold", earned_at: "2026-09-28T12:00:00",
    };
    expect(goldEntryBody(entry)).toEqual({
      source: "Trade", amount: 500, character_id: null, account_id: 2, note: "sold", earned_at: "2026-09-28T12:00:00",
    });
  });

  it("turns a check-in's balances back into what was entered", () => {
    const check = {
      id: 4, account_id: 1, checked_at: "2026-10-01T10:00:00", note: null,
      actual: { tradeable: 100, roster_bound: 20, character_bound: { "5": 7 }, total: 127 },
      expected: null, untracked: null,
    } as BalanceCheck;
    expect(checkInBody(check)).toEqual({
      tradeable: 100, roster_bound: 20, character_bound: { "5": 7 }, note: null, checked_at: "2026-10-01T10:00:00", account_id: 1,
    });
  });
});
