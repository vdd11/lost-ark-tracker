import { describe, expect, it } from "vitest";

import { Character, Task } from "./api";
import { missedGoldRaids, topSources } from "./recap";

const raid = (id: number, gold: number) =>
  ({
    id, name: `R${id}`, category: "raid", archived: false, ends_on: null, gold_for_everyone: false, gold: 0,
    difficulties: [{ id: id * 10, task_id: id, name: "Normal", position: 0, min_item_level: 1700, gold }],
  }) as unknown as Task;
const raids = [raid(1, 30000), raid(2, 40000), raid(3, 50000), raid(4, 20000)];
const who = (id: number, extra: Partial<Character> = {}) =>
  ({ id, name: `C${id}`, item_level: 1750, is_gold_earner: true, account_id: 1, task_ids: [], difficulty_ids: {}, ...extra }) as Character;

describe("missedGoldRaids", () => {
  it("counts each gold earner's unused gold slots", () => {
    const rows = missedGoldRaids([who(1), who(2), who(3, { is_gold_earner: false })], raids, { "1": 3, "2": 1 });
    expect(rows.map((r) => [r.character.id, r.missed])).toEqual([[2, 2]]);
  });

  it("never asks for more than a character can enter", () => {
    expect(missedGoldRaids([who(1, { item_level: 1600 })], raids, {})).toEqual([]);
  });
});

describe("topSources", () => {
  it("lists the biggest sources first and leaves out empty ones", () => {
    expect(topSources({ Raids: 300000, "Chaos Gate": 12000, "Field Boss": 30000, Other: 0, Fate: 500 }, 3)).toEqual([
      ["Raids", 300000],
      ["Field Boss", 30000],
      ["Chaos Gate", 12000],
    ]);
    expect(topSources({})).toEqual([]);
  });
});
