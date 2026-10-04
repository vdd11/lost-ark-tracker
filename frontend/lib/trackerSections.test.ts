import { describe, expect, it } from "vitest";

import { Character, Task } from "./api";
import { buildSection, cellKey, formatCountdown } from "./trackerSections";
import { FINISHED_ROWS_KEY } from "./trackerView";

const task = (id: number, extra: Partial<Task>) =>
  ({
    id, name: `T${id}`, category: "daily", position: id, counted: false, catalog_key: null,
    archived: false, ends_on: null, roster_limited: false, difficulties: [], ...extra,
  }) as Task;
const who = (id: number, taskIds: number[]) =>
  ({ id, name: `C${id}`, position: id, item_level: 1700, task_ids: taskIds }) as Character;

const chaos = task(1, { name: "Chaos Dungeon" });
const guardian = task(2, { name: "Guardian Raid" });
const tasks = [guardian, chaos];
const base = { tasks, completed: new Set<string>(), hidden: new Set<string>(), editMode: false };

describe("buildSection", () => {
  it("shows only tasks and characters that apply, in position order", () => {
    const roster = [who(1, [1]), who(2, [])];
    const today = buildSection("today", { ...base, roster });
    expect(today.columns.map((t) => t.name)).toEqual(["Chaos Dungeon"]);
    expect(today.rows.map((c) => c.id)).toEqual([1]);
  });

  it("counts progress and tucks away finished characters when asked", () => {
    const roster = [who(1, [1, 2]), who(2, [1, 2])];
    const completed = new Set([cellKey(1, 1), cellKey(1, 2), cellKey(2, 1)]);
    const shown = buildSection("today", { ...base, roster, completed });
    expect([shown.done, shown.total, shown.finished.length]).toEqual([3, 4, 0]);

    const tucked = buildSection("today", { ...base, roster, completed, hidden: new Set([FINISHED_ROWS_KEY]) });
    expect(tucked.finished.map((c) => c.id)).toEqual([1]);
    expect(tucked.rows.map((c) => c.id)).toEqual([2]);
  });

  it("shows everyone and every task in edit mode, minus hidden tasks", () => {
    const roster = [who(1, []), who(2, [])];
    const edit = buildSection("today", { ...base, roster, editMode: true, hidden: new Set(["task:Guardian Raid"]) });
    expect(edit.columns.map((t) => t.name)).toEqual(["Chaos Dungeon"]);
    expect(edit.rows).toHaveLength(2);
  });
});

describe("formatCountdown", () => {
  it("shows days and hours, or hours and minutes on the last day", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    expect(formatCountdown(new Date("2026-10-03T05:30:00Z"), now)).toBe("2d 5h");
    expect(formatCountdown(new Date("2026-10-01T03:12:00Z"), now)).toBe("3h 12m");
    expect(formatCountdown(new Date("2026-09-30T00:00:00Z"), now)).toBe("0h 0m");
  });
});
