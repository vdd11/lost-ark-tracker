import { describe, expect, it } from "vitest";

import { Difficulty, Task } from "./api";
import { bestRaidTier, tierHint, tierTone } from "./itemLevelTier";

let nextId = 1;

function raid(name: string, tiers: [string, number, number | null][], extra: Partial<Task> = {}): Task {
  const id = nextId++;
  const difficulties = tiers.map(([tier, itemLevel, gold], position) => ({
    id: id * 100 + position, task_id: id, name: tier, position, min_item_level: itemLevel, gold,
  })) as Difficulty[];
  return {
    id, name, category: "raid", gold: 0, position: id, rest_max: 0, rest_gain: 0, rest_cost: 0,
    catalog_key: name, archived: false, ends_on: null, roster_limited: false, gold_for_everyone: false,
    note: null, counted: false, sand_scaled: false, gate_count: 0, difficulties, ...extra,
  };
}

const today = new Date("2026-10-05T12:00:00Z");
const tasks = [
  raid("Serca", [["Normal", 1710, 32000], ["Hard", 1730, 44000], ["Nightmare", 1740, 54000]]),
  raid("Horizon Cathedral", [["Lv1", 1700, 30000], ["Lv2", 1720, 40000], ["Lv3", 1750, 50000]]),
  raid("The Final Day", [["Normal", 1710, 32000], ["Hard", 1730, 48000]]),
  raid("Act 3 Extreme", [["Nightmare", 1770, 45000]], { ends_on: "2026-10-28", catalog_key: null }),
];

describe("bestRaidTier", () => {
  it("ranks the hardest gate a character clears among all current gates, ignoring events", () => {
    expect(bestRaidTier(1775, tasks, today)?.rank).toBe(0); // 1750 is the top gate; the event's 1770 doesn't count
    expect(bestRaidTier(1745, tasks, today)?.difficulty.name).toBe("Nightmare");
    expect(bestRaidTier(1745, tasks, today)?.rank).toBe(1);
    expect(bestRaidTier(1699, tasks, today)).toBeNull();
  });

  it("breaks ties at one item level by gold", () => {
    const tier = bestRaidTier(1735, tasks, today)!;
    expect(`${tier.task.name} ${tier.difficulty.name}`).toBe("The Final Day Hard");
    expect(tierHint(tier)).toBe("Can enter up to The Final Day Hard (1730)");
  });

  it("colours by rank, like item grades", () => {
    expect(tierTone(bestRaidTier(1760, tasks, today))).toBe("text-[#d9661f]");
    expect(tierTone(bestRaidTier(1735, tasks, today))).toBe("text-accent");
    expect(tierTone(bestRaidTier(1712, tasks, today))).toBe("text-[#9b5de5]");
    expect(tierTone(bestRaidTier(1700, tasks, today))).toBe("text-series-1");
    expect(tierTone(null)).toBe("text-muted");
  });
});
