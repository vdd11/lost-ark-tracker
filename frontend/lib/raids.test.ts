import { describe, expect, it } from "vitest";

import { Character, Difficulty, Task } from "./api";
import {
  bestDifficulty,
  canRun,
  formatShortGold,
  isActiveRaid,
  paidRaids,
  possibleRaidGold,
  shortDifficulty,
  topGoldRaids,
} from "./raids";

let nextId = 1;

function raid(name: string, tiers: [string, number, number | null][], extra: Partial<Task> = {}): Task {
  const id = nextId++;
  const difficulties: Difficulty[] = tiers.map(([tier, itemLevel, gold], position) => ({
    id: id * 100 + position,
    task_id: id,
    name: tier,
    position,
    min_item_level: itemLevel,
    gold,
    catalog_item_level: itemLevel,
    catalog_gold: gold,
    bound_percent: 0,
    catalog_bound_percent: 0,
    bound_kind: "roster",
    catalog_bound_kind: "roster",
    bonus_cost: null,
    catalog_bonus_cost: null,
    reward_gems: null,
    lucky_gems: null,
    mega_gems: null,
    catalog_rewards: null,
  }));
  return {
    id, name, category: "raid", gold: 0, position: id,
    rest_max: 0, rest_gain: 0, rest_cost: 0,
    catalog_key: null, archived: false, ends_on: null, roster_limited: false,
    gold_for_everyone: false, note: null, counted: false, sand_scaled: false,
    difficulties, ...extra,
  };
}

function character(itemLevel: number, runs: [Task, string][], extra: Partial<Character> = {}): Character {
  return {
    id: nextId++, name: "C", class_name: "Bard", item_level: itemLevel, is_gold_earner: true,
    reserved_for: null, position: 0,
    task_ids: runs.map(([task]) => task.id),
    difficulty_ids: Object.fromEntries(
      runs.map(([task, tier]) => [String(task.id), task.difficulties.find((d) => d.name === tier)!.id]),
    ),
    ...extra,
  };
}

const serca = raid("Serca", [["Normal", 1710, 32000], ["Hard", 1730, 44000], ["Nightmare", 1740, 54000]]);
const cathedral = raid("Horizon Cathedral", [["Lv1", 1700, 30000], ["Lv2", 1720, 40000], ["Lv3", 1750, 50000]]);
const finalDay = raid("The Final Day", [["Normal", 1710, 32000], ["Hard", 1730, 48000]]);
const act4 = raid("Act 4", [["Normal", 1700, 27000], ["Hard", 1720, 38000]]);
const extreme = raid("Act 3 Extreme", [["Normal", 1720, 20000], ["Hard", 1750, 45000]], {
  ends_on: "2099-01-01", roster_limited: true, gold_for_everyone: true,
});
const raids = [serca, cathedral, finalDay, act4, extreme];

describe("bestDifficulty", () => {
  it("picks the hardest tier the item level reaches", () => {
    expect(bestDifficulty(cathedral, 1749)?.name).toBe("Lv2");
    expect(bestDifficulty(cathedral, 1750)?.name).toBe("Lv3");
  });

  it("falls back to the easiest tier when under-leveled", () => {
    expect(bestDifficulty(serca, 1600)?.name).toBe("Normal");
  });
});

describe("canRun", () => {
  it("needs the easiest tier's item level", () => {
    expect(canRun(character(1709, []), serca)).toBe(false);
    expect(canRun(character(1710, []), serca)).toBe(true);
  });
});

describe("topGoldRaids", () => {
  it("suggests the three best-paying raids at the right tier, skipping events", () => {
    const picks = topGoldRaids(raids, 1775).map(({ task, difficulty }) => `${task.name} ${difficulty.name}`);
    expect(picks).toEqual(["Serca Nightmare", "Horizon Cathedral Lv3", "The Final Day Hard"]);
  });

  it("only suggests raids the character can enter", () => {
    expect(topGoldRaids(raids, 1705).map(({ task }) => task.name)).toEqual(["Horizon Cathedral", "Act 4"]);
  });
});

describe("possibleRaidGold", () => {
  it("pays each gold earner for their three best raids", () => {
    const main = character(1775, [[serca, "Nightmare"], [cathedral, "Lv3"], [finalDay, "Hard"], [act4, "Hard"]]);
    expect(paidRaids(main, raids)).toHaveLength(4);
    expect(possibleRaidGold([main], raids)).toBe(54000 + 50000 + 48000);
  });

  it("ignores characters that don't earn gold", () => {
    const friendAlt = character(1775, [[serca, "Nightmare"]], { is_gold_earner: false });
    expect(possibleRaidGold([friendAlt], raids)).toBe(0);
  });

  it("counts a roster-limited event once, at the best assigned tier", () => {
    const a = character(1760, [[extreme, "Hard"]]);
    const b = character(1725, [[extreme, "Normal"]], { is_gold_earner: false });
    expect(possibleRaidGold([a, b], raids)).toBe(45000);
  });

  it("treats unknown gold as zero", () => {
    const unknown = raid("Mystery", [["Normal", 1700, null]]);
    expect(possibleRaidGold([character(1700, [[unknown, "Normal"]])], [unknown])).toBe(0);
  });
});

describe("isActiveRaid", () => {
  it("hides archived and ended raids", () => {
    expect(isActiveRaid(serca)).toBe(true);
    expect(isActiveRaid({ ...serca, archived: true })).toBe(false);
    expect(isActiveRaid({ ...extreme, ends_on: "2020-01-01" })).toBe(false);
  });
});

describe("formatting", () => {
  it("shortens difficulties and gold for tracker cells", () => {
    expect(shortDifficulty("Nightmare")).toBe("NM");
    expect(shortDifficulty("Lv3")).toBe("Lv3");
    expect(formatShortGold(38000)).toBe("38k");
    expect(formatShortGold(27500)).toBe("27.5k");
    expect(formatShortGold(null)).toBe("?");
  });
});
