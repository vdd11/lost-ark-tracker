import { describe, expect, it } from "vitest";

import { Character, Difficulty, Task } from "./api";
import { cellKey } from "./trackerSections";
import { whatsLeft, whatsLeftText } from "./whatsLeft";

let id = 1;
const tier = (taskId: number, name: string, gold: number | null): Difficulty =>
  ({ id: taskId * 10, task_id: taskId, name, position: 0, min_item_level: 1700, gold }) as Difficulty;
const raid = (name: string, gold: number | null, extra: Partial<Task> = {}): Task => {
  const taskId = id++;
  return {
    id: taskId, name, category: "raid", position: taskId, gold: 0, archived: false, ends_on: null, counted: false,
    roster_limited: false, gold_for_everyone: false, difficulties: [tier(taskId, "Hard", gold)], ...extra,
  } as Task;
};
const daily = (name: string): Task =>
  ({ id: id++, name, category: "daily", position: 99, gold: 0, counted: false, roster_limited: false, difficulties: [] }) as unknown as Task;
const who = (name: string, tasks: Task[], extra: Partial<Character> = {}): Character => ({
  id: id++, name, class_name: "Bard", item_level: 1770, is_gold_earner: true, position: 0, account_id: 1, azena_until: null, inanna_until: null,
  task_ids: tasks.map((t) => t.id),
  difficulty_ids: Object.fromEntries(tasks.filter((t) => t.difficulties.length).map((t) => [String(t.id), t.difficulties[0].id])),
  ...extra,
});

const serca = raid("Serca", 54000);
const cathedral = raid("Horizon Cathedral", 50000);
const finalDay = raid("The Final Day", 48000);
const act4 = raid("Act 4", 38000);
const mystery = raid("Mystery", null);
const cube = { ...raid("Ebony Cube", 0), category: "weekly", counted: true } as Task;
const extreme = raid("Act 3 Extreme", 45000, { roster_limited: true, gold_for_everyone: true });
const chaos = daily("Chaos Dungeon");
const tasks = [serca, cathedral, finalDay, act4, mystery, cube, extreme, chaos];

describe("whatsLeft", () => {
  it("lists unfinished usual tasks, raids by gold, with only paid slots paying", () => {
    const alpha = who("Alpha", [act4, serca, cathedral, finalDay, chaos]);
    const completed = new Set([cellKey(alpha.id, cathedral.id)]);
    const runs = [{ character_id: alpha.id, task_id: cathedral.id, difficulty_id: cathedral.difficulties[0].id }] as never[];
    const [group] = whatsLeft({ roster: [alpha], columns: tasks, tasks, completed, runs });
    expect(group.items.map((i) => [i.task.name, i.gold, i.paying])).toEqual([
      ["Serca", 54000, true],
      ["The Final Day", 48000, true],
      ["Act 4", 0, false],
      ["Chaos Dungeon", 0, false],
    ]);
    expect(group.gold).toBe(54000 + 48000);
  });

  it("leaves out Ebony Cube and once-per-account events, flags unknown gold, and orders by gold", () => {
    // Below every raid's item level, so no suggestions get mixed in.
    const poor = who("Poor", [mystery, cube, extreme], { item_level: 1600 });
    const rich = who("Rich", [serca], { item_level: 1600 });
    const groups = whatsLeft({ roster: [poor, rich], columns: tasks, tasks, completed: new Set(), runs: [] });
    expect(groups.map((g) => g.character.name)).toEqual(["Rich", "Poor"]);
    expect(groups[1].items.map((i) => [i.task.name, i.unknownGold])).toEqual([["Mystery", true]]);
  });

  it("suggests the best raids a gold earner can enter for slots their usual raids leave open", () => {
    const fresh = who("Fresh", [chaos]);
    const [group] = whatsLeft({ roster: [fresh], columns: tasks, tasks, completed: new Set(), runs: [] });
    expect(group.items.map((i) => [i.task.name, i.suggested ?? false])).toEqual([
      ["Serca", true],
      ["Horizon Cathedral", true],
      ["The Final Day", true],
      ["Chaos Dungeon", false],
    ]);
    expect(group.gold).toBe(54000 + 50000 + 48000);
  });

  it("drops characters with nothing left and writes a Discord summary", () => {
    const done = who("Done", [chaos], { item_level: 1600 });
    const alpha = who("Alpha", [serca, chaos], { item_level: 1600 });
    const groups = whatsLeft({
      roster: [done, alpha], columns: tasks, tasks, completed: new Set([cellKey(done.id, chaos.id)]), runs: [],
    });
    expect(whatsLeftText(groups)).toBe("Alpha: Serca Hard, Chaos Dungeon");
  });
});

describe("What's left with gates", () => {
  it("lists only the gates left of a partly cleared raid, with their gold", () => {
    const gated = raid("Gated", 44000, { gate_count: 2 });
    gated.difficulties[0] = { ...gated.difficulties[0], gate_gold: [17500, 26500] };
    const main = who("Main", [gated]);
    const run = { character_id: main.id, task_id: gated.id, difficulty_id: gated.difficulties[0].id, count: 1, gates: { "1": gated.difficulties[0].id } };
    const [group] = whatsLeft({ roster: [main], columns: [gated], tasks: [gated], completed: new Set(), runs: [run as never] });
    expect(group.items.map((i) => [i.tierName, i.gold])).toEqual([["Hard G2", 26500]]);
  });
});
