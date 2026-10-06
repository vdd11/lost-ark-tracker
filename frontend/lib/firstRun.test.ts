import { describe, expect, it } from "vitest";

import { Account, Character } from "./api";
import { earnersByAccount, showFirstRun } from "./firstRun";

const character = (id: number, accountId: number, earner: boolean) =>
  ({ id, name: `C${id}`, class_name: "Bard", item_level: 1700, is_gold_earner: earner, position: id, account_id: accountId, task_ids: [], difficulty_ids: {} }) as Character;
const account = (id: number, name: string) => ({ id, name, position: id, characters: 0 }) as Account;

describe("showFirstRun", () => {
  it("shows on an empty tracker, stays while active, and never after it's done", () => {
    expect(showFirstRun(false, 0, "")).toBe(false); // still loading
    expect(showFirstRun(true, 0, "")).toBe(true);
    expect(showFirstRun(true, 3, "")).toBe(false); // an existing roster never sees it
    expect(showFirstRun(true, 3, "active")).toBe(true);
    expect(showFirstRun(true, 0, "done")).toBe(false);
  });
});

describe("earnersByAccount", () => {
  it("counts gold earners per account", () => {
    const groups = earnersByAccount([character(1, 1, true), character(2, 1, false), character(3, 2, true)], [account(1, "Main"), account(2, "Alt")]);
    expect(groups.map((g) => `${g.name} ${g.earners}/${g.max} of ${g.characters.length}`)).toEqual(["Main 1/6 of 2", "Alt 1/6 of 1"]);
  });

  it("treats a roster without accounts as one", () => {
    expect(earnersByAccount([character(1, 1, true)], [])[0]).toMatchObject({ name: "Your roster", earners: 1 });
  });
});
