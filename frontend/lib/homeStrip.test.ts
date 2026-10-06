import { describe, expect, it } from "vitest";

import { Character, RestState, Run, Task } from "./api";
import { homeNudges } from "./homeStrip";

const chaos = { id: 1, name: "Chaos Dungeon", category: "daily", rest_max: 200, difficulties: [] } as unknown as Task;
const hourglass = {
  id: 2, name: "Haal's Hourglass", category: "weekly", rest_max: 0, sand_scaled: true,
  difficulties: [{ id: 21, name: "Lv1", min_item_level: 1730 }],
} as unknown as Task;
const char = (id: number, name: string, item_level: number) =>
  ({ id, name, item_level, task_ids: [1, 2], difficulty_ids: {} }) as unknown as Character;
const main = char(1, "Main", 1750);
const alt = char(2, "Alt", 1700); // can't enter the Hourglass

describe("homeNudges", () => {
  it("names full rest gauges, Hourglass runs left, and field events when on", () => {
    const rests = [{ character_id: 1, task_id: 1, value: 200 }, { character_id: 2, task_id: 1, value: 60 }] as RestState[];
    const nudges = homeNudges({ characters: [main, alt], tasks: [chaos, hourglass], rests, runs: [], dailyPeriod: "2026-10-04", fieldEvents: true });
    expect(nudges.map((n) => n.text)).toEqual([
      "Chaos Dungeon rest full on 1 character",
      "Haal's Hourglass left on 1 character",
      "Field Boss today",
      "Chaos Gate today",
    ]);
    expect(nudges[0].title).toContain("Main");
  });

  it("is empty when there's nothing to do", () => {
    const runs = [{ character_id: 1, task_id: 2 }] as Run[];
    expect(homeNudges({ characters: [main, alt], tasks: [chaos, hourglass], rests: [], runs, dailyPeriod: "2026-10-04", fieldEvents: false })).toEqual([]);
  });
});
