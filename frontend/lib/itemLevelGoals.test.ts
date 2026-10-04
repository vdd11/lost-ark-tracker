import { describe, expect, it } from "vitest";

import { Character, Difficulty, Task } from "./api";
import { formatGap, nextUnlock } from "./itemLevelGoals";

let id = 1;
const task = (name: string, tiers: [string, number, number | null][], extra: Partial<Task> = {}): Task => {
  const taskId = id++;
  return {
    id: taskId, name, category: "raid", archived: false, ends_on: null,
    difficulties: tiers.map(([tier, ilvl, gold], position) => ({ id: taskId * 10 + position, task_id: taskId, name: tier, position, min_item_level: ilvl, gold }) as Difficulty),
    ...extra,
  } as Task;
};
const at = (item_level: number) => ({ item_level }) as Character;

const serca = task("Serca", [["Normal", 1710, 32000], ["Hard", 1730, 44000], ["Nightmare", 1740, 54000]]);
const finalDay = task("The Final Day", [["Normal", 1710, 32000], ["Hard", 1730, 48000]]);
const hourglass = task("Haal's Hourglass", [["Lv1", 1730, 0], ["Lv2", 1750, 0]], { category: "weekly" });
const tasks = [serca, finalDay, hourglass];

describe("nextUnlock", () => {
  it("finds the nearest unlock, breaking ties by gold", () => {
    const next = nextUnlock(at(1725), tasks)!;
    expect([next.task.name, next.difficulty.name, next.gap]).toEqual(["The Final Day", "Hard", 5]);
  });

  it("looks past raids to tiered weeklies, and rounds the gap", () => {
    const next = nextUnlock(at(1745.83), tasks)!;
    expect([next.task.name, next.difficulty.name, next.gap]).toEqual(["Haal's Hourglass", "Lv2", 4.17]);
  });

  it("skips archived and ended raids, and is null when nothing is left", () => {
    const ended = task("Old Extreme", [["Hard", 1726, 45000]], { ends_on: "2020-01-01" });
    const archived = task("Gone", [["Normal", 1726, 1000]], { archived: true });
    expect(nextUnlock(at(1725), [...tasks, ended, archived])!.difficulty.min_item_level).toBe(1730);
    expect(nextUnlock(at(1770), tasks)).toBeNull();
  });

  it("formats the gap like an item level", () => {
    expect([formatGap(5), formatGap(4.2), formatGap(0.83)]).toEqual(["+5", "+4.20", "+0.83"]);
  });
});
