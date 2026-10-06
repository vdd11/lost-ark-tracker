import { describe, expect, it } from "vitest";

import { Character, Task } from "./api";
import { dropsEmbers, embersThisWeek } from "./embers";

describe("embers", () => {
  it("come from Chaos Dungeon and Guardian Raid only", () => {
    expect(dropsEmbers({ name: "Chaos Dungeon", category: "daily" } as Task)).toBe(true);
    expect(dropsEmbers({ name: "Guardian Raid", category: "daily" } as Task)).toBe(true);
    expect(dropsEmbers({ name: "Ebony Cube", category: "weekly" } as Task)).toBe(false);
  });

  it("sum the week for the characters shown", () => {
    const shown = [{ id: 1 }, { id: 2 }] as Character[];
    const weeks = [
      { character_id: 1, fate: 3, blessed: 1 },
      { character_id: 2, fate: 2, blessed: 0 },
      { character_id: 9, fate: 5, blessed: 5 }, // another account
    ];
    expect(embersThisWeek(weeks, shown)).toEqual({ fate: 5, blessed: 1 });
  });
});
