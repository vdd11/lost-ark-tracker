import { describe, expect, it } from "vitest";

import { Character, Task } from "./api";
import { dailiesToday } from "./dailies";

const task = (id: number, name: string) => ({ id, name, category: "daily", difficulties: [] }) as unknown as Task;
const char = (id: number, task_ids: number[]) => ({ id, task_ids }) as unknown as Character;

describe("dailiesToday", () => {
  it("counts who's done per daily, only among those who do it", () => {
    const chaos = task(1, "Chaos Dungeon");
    const guardian = task(2, "Guardian Raid");
    const unused = task(3, "Nobody does this");
    const a = char(1, [1, 2]);
    const b = char(2, [1]);
    const result = dailiesToday([chaos, guardian, unused], [a, b], (c, t) => c.id === 1 && t.id === 1);
    expect(result.perTask.map((p) => [p.task.name, p.done, p.total])).toEqual([
      ["Chaos Dungeon", 1, 2],
      ["Guardian Raid", 0, 1],
    ]);
    expect([result.done, result.total]).toEqual([1, 3]);
  });
});
