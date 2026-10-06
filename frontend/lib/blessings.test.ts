import { describe, expect, it } from "vitest";

import { Character, Run, Task } from "./api";
import { blessingActive, chaosRunsPerDay, dailyRunsNeeded, fullyDone, gameDay } from "./blessings";

const char = (item_level: number, innana_until: string | null, azena_until: string | null = null) =>
  ({ item_level, innana_until, azena_until }) as Character;

describe("blessings", () => {
  it("uses the game day, which starts at the 10:00 UTC reset", () => {
    expect(gameDay(new Date("2026-10-07T09:59:00Z"))).toBe("2026-10-06");
    expect(gameDay(new Date("2026-10-07T10:00:00Z"))).toBe("2026-10-07");
  });

  it("lasts through its end date", () => {
    const c = char(1740, "2026-10-07", "2026-10-01");
    expect(blessingActive(c, "innana", "2026-10-07")).toBe(true);
    expect(blessingActive(c, "innana", "2026-10-08")).toBe(false);
    expect(blessingActive(c, "azena", "2026-10-07")).toBe(false);
    expect(blessingActive(char(1740, null), "innana", "2026-10-07")).toBe(false);
  });

  it("gives a second Chaos Dungeon run with Innana's at 1730+", () => {
    expect(chaosRunsPerDay(char(1740, "2026-12-01"), "2026-10-07")).toBe(2);
    expect(chaosRunsPerDay(char(1720, "2026-12-01"), "2026-10-07")).toBe(1);
    expect(chaosRunsPerDay(char(1740, null), "2026-10-07")).toBe(1);
  });
});

describe("Innana's second run", () => {
  const chaos = { id: 1, name: "Chaos Dungeon", category: "daily" } as Task;
  const guardian = { id: 2, name: "Guardian Raid", category: "daily" } as Task;
  const blessed = { ...char(1740, "2026-12-01"), id: 1 } as Character;
  const plain = { ...char(1740, null), id: 2 } as Character;
  const day = "2026-10-07";

  it("needs two Chaos Dungeon runs only while blessed", () => {
    expect(dailyRunsNeeded(blessed, chaos, day)).toBe(2);
    expect(dailyRunsNeeded(blessed, guardian, day)).toBe(1);
    expect(dailyRunsNeeded(plain, chaos, day)).toBe(1);
    expect(dailyRunsNeeded(blessed, chaos, null)).toBe(1);
  });

  it("leaves a half-done day out of the done cells", () => {
    const runs = [
      { character_id: 1, task_id: 1, count: 1 },
      { character_id: 1, task_id: 2, count: 1 },
      { character_id: 2, task_id: 1, count: 1 },
    ] as Run[];
    const done = fullyDone(new Set(["1:1", "1:2", "2:1"]), runs, [blessed, plain], [chaos, guardian], day);
    expect([...done].sort()).toEqual(["1:2", "2:1"]);
    const twice = runs.map((r) => (r.character_id === 1 && r.task_id === 1 ? { ...r, count: 2 } : r));
    expect(fullyDone(new Set(["1:1", "1:2", "2:1"]), twice, [blessed, plain], [chaos, guardian], day).has("1:1")).toBe(true);
  });
});
