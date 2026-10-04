import { describe, expect, it } from "vitest";

import { Character } from "./api";
import { memberStatuses, parseMembers, RaidGroup } from "./raidGroups";

const character = (id: number, name: string) => ({ id, name }) as Character;
const group = (extra: Partial<RaidGroup>): RaidGroup => ({
  id: 1, name: "Static", task_id: 5, schedule: null, members: [], notes: null, position: 0, ...extra,
});

describe("memberStatuses", () => {
  const roster = [character(1, "Bardy"), character(2, "Sorcy")];
  const done = new Set(["1:5"]);
  const isDone = (c: number, t: number) => done.has(`${c}:${t}`);

  it("marks your characters done or left, and others as other players", () => {
    const result = memberStatuses(group({ members: ["bardy", "Sorcy", "Friendo"] }), roster, isDone);
    expect(result.map((m) => [m.name, m.status, m.character?.id ?? null])).toEqual([
      ["bardy", "done", 1],
      ["Sorcy", "left", 2],
      ["Friendo", "other", null],
    ]);
  });

  it("can't tell without a raid", () => {
    expect(memberStatuses(group({ task_id: null, members: ["Bardy"] }), roster, isDone)[0].status).toBe("other");
  });
});

describe("parseMembers", () => {
  it("splits on commas and new lines and drops blanks and repeats", () => {
    expect(parseMembers("Bardy, Sorcy\nTanky,, Bardy ")).toEqual(["Bardy", "Sorcy", "Tanky"]);
  });
});
