import { describe, expect, it } from "vitest";

import { Character, Difficulty, Run, Task } from "./api";
import {
  bestDifficulty,
  clearedGates,
  gatesBody,
  isWholeClear,
  remainingGateGold,
  remainingGates,
  boundLabel,
  canRun,
  formatShortGold,
  goldRaidsLeft,
  goldRaidWeek,
  isActiveRaid,
  paidRaids,
  possibleRaidGold,
  possibleSharedGold,
  settingsRaidLists,
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
    gate_gold: null,
    gate_bonus: null,
    reward_gems: null,
    lucky_gems: null,
    mega_gems: null,
    catalog_rewards: null,
  }));
  return {
    id, name, category: "raid", gold: 0, position: id,
    rest_max: 0, rest_gain: 0, rest_cost: 0,
    catalog_key: null, archived: false, ends_on: null, roster_limited: false,
    gold_for_everyone: false, note: null, counted: false, sand_scaled: false, gate_count: 0, run_limit: 0,
    difficulties, ...extra,
  };
}

function character(itemLevel: number, runs: [Task, string][], extra: Partial<Character> = {}): Character {
  return {
    id: nextId++, name: "C", class_name: "Bard", item_level: itemLevel, is_gold_earner: true,
    position: 0, account_id: 1, azena_until: null, inanna_until: null,
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
    // Event raids pay even characters that aren't gold earners.
    const a = character(1760, [[extreme, "Hard"]], { is_gold_earner: false });
    const b = character(1725, [[extreme, "Normal"]], { is_gold_earner: false });
    expect(possibleRaidGold([a, b], raids)).toBe(45000);
  });

  it("can leave out character-bound gold (the Gold this week box)", () => {
    const bound = raid("Bound", [["Normal", 1700, 40000]]);
    bound.difficulties[0] = { ...bound.difficulties[0], bound_percent: 25, bound_kind: "character" };
    const roster = raid("RosterBound", [["Normal", 1700, 30000]]);
    roster.difficulties[0] = { ...roster.difficulties[0], bound_percent: 50, bound_kind: "roster" };
    const main = character(1700, [[bound, "Normal"], [roster, "Normal"]]);
    expect(possibleRaidGold([main], [bound, roster])).toBe(70000);
    // A quarter of Bound's 40,000 is character-bound; roster-bound gold still counts.
    expect(possibleSharedGold([main], [bound, roster])).toBe(30000 + 30000);
  });

  it("treats unknown gold as zero", () => {
    const unknown = raid("Mystery", [["Normal", 1700, null]]);
    expect(possibleRaidGold([character(1700, [[unknown, "Normal"]])], [unknown])).toBe(0);
  });
});

function clear(who: Character, task: Task, tier: string): Run {
  return {
    character_id: who.id, task_id: task.id, difficulty_id: task.difficulties.find((d) => d.name === tier)!.id,
    count: 1, lucky_rooms: 0, mega_rooms: 0, sands: 0, fate_embers: 0, blessed_embers: 0, bought_bonus: false, bonus_spent: 0,
    tier_counts: null, gates: null, gems: null,
  };
}

describe("goldRaidWeek", () => {
  const usual: [Task, string][] = [[serca, "Nightmare"], [cathedral, "Lv3"], [finalDay, "Hard"]];

  it("counts down the three paying raids", () => {
    const main = character(1770, usual);
    expect(goldRaidWeek(main, raids, [])).toMatchObject({ slots: 3, cleared: 0, left: 3, possible: 152000 });
    expect(goldRaidWeek(main, raids, [clear(main, serca, "Nightmare")])).toMatchObject({ cleared: 1, left: 2, possible: 152000 });
  });

  it("doesn't raise possible gold for a fourth clear", () => {
    const main = character(1770, usual);
    const runs = [...usual.map(([task, tier]) => clear(main, task, tier)), clear(main, act4, "Hard")];
    expect(goldRaidWeek(main, raids, runs)).toMatchObject({ cleared: 3, left: 0, possible: 152000 });
  });

  it("counts an extra clear instead of a usual raid, so earned never passes possible", () => {
    const alt = character(1770, [[serca, "Nightmare"], [cathedral, "Lv3"]]);
    const runs = [clear(alt, serca, "Nightmare"), clear(alt, finalDay, "Hard")];
    expect(goldRaidWeek(alt, raids, runs)).toMatchObject({ slots: 3, cleared: 2, left: 1, possible: 152000 });
  });

  it("fills missing usual raids with the best ones they can enter", () => {
    const fresh = character(1725, []);
    expect(goldRaidWeek(fresh, raids, [])).toMatchObject({ slots: 3, left: 3, possible: 40000 + 38000 + 32000 });
    const low = character(1690, []);
    expect(goldRaidWeek(low, raids, [])).toMatchObject({ slots: 0, left: 0, possible: 0 });
  });

  it("totals what's left across the roster, with one roster-wide event", () => {
    const a = character(1770, usual);
    const b = character(1770, usual);
    const runs = [clear(a, serca, "Nightmare")];
    expect(goldRaidsLeft([a, b], raids, runs)).toEqual({ left: 5, slots: 6, events: 1 });
    expect(goldRaidsLeft([a, b], raids, [...runs, clear(b, extreme, "Hard")]).events).toBe(0);
    expect(possibleRaidGold([a, b], raids, [clear(b, extreme, "Hard")])).toBe(2 * 152000 + 45000);
  });
});

describe("accounts", () => {
  it("gives each account its own roster-limited event clear", () => {
    const usual: [Task, string][] = [[extreme, "Hard"]];
    const main = character(1760, usual, { is_gold_earner: false });
    const sameAccount = character(1760, usual, { is_gold_earner: false });
    const otherAccount = character(1760, usual, { is_gold_earner: false, account_id: 2 });
    expect(goldRaidsLeft([main, sameAccount, otherAccount], raids, []).events).toBe(2);
    expect(possibleRaidGold([main, sameAccount, otherAccount], raids, [])).toBe(2 * 45000);
    expect(goldRaidsLeft([main, sameAccount, otherAccount], raids, [clear(main, extreme, "Hard")]).events).toBe(1);
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

describe("settingsRaidLists", () => {
  it("splits event, custom and hidden built-in raids", () => {
    const today = new Date("2026-10-05T12:00:00Z");
    const builtIn = raid("Act 4", [["Normal", 1700, 27000]], { catalog_key: "kazeros-act-4" });
    const hidden = raid("Serca", [["Normal", 1710, 32000]], { catalog_key: "shadow-serca", archived: true });
    const live = raid("Act 3 Extreme", [["Normal", 1720, 20000]], { ends_on: "2026-10-28" });
    const past = raid("Act 2 Extreme", [["Normal", 1720, 20000]], { ends_on: "2026-09-01" });
    const custom = raid("Old custom", [["Normal", 1600, null]]);
    const lists = settingsRaidLists([builtIn, hidden, live, past, custom], today);
    expect(lists.live).toEqual([live]);
    expect(lists.past).toEqual([past]);
    expect(lists.custom).toEqual([custom]);
    expect(lists.hidden).toEqual([hidden]);
  });

  it("labels bound gold", () => {
    expect(boundLabel(0, "roster")).toBe("");
    expect(boundLabel(50, "roster")).toBe("50% roster");
  });
});

describe("raids cleared gate by gate", () => {
  const gated = raid("Gated", [["Normal", 1710, 32000], ["Hard", 1730, 44000]], { gate_count: 2 });
  gated.difficulties[0] = { ...gated.difficulties[0], gate_gold: [13000, 19000], bound_percent: 50 };
  gated.difficulties[1] = { ...gated.difficulties[1], gate_gold: [17500, 26500] };
  const [normal, hard] = gated.difficulties.map((d) => d.id);
  const partial = (who: Character, gates: Record<string, number>): Run => ({ ...clear(who, gated, "Normal"), gates });

  it("knows which gates are cleared, and what's left", () => {
    const main = character(1740, [[gated, "Hard"]]);
    expect(clearedGates(gated, clear(main, gated, "Hard"))).toEqual({ 1: hard, 2: hard });
    const run = partial(main, { "1": normal });
    expect(isWholeClear(gated, run)).toBe(false);
    expect(remainingGates(gated, run, hard)).toEqual({ 2: hard });
    expect(remainingGateGold(gated, run, hard)).toBe(26500);
    expect(gatesBody(gated, run)).toEqual({ 1: normal, 2: 0 });
  });

  it("a partly cleared raid holds its paid slot but is still left, and counts what all its gates can pay", () => {
    const main = character(1740, [[gated, "Hard"]]);
    const week = goldRaidWeek(main, [gated], [partial(main, { "1": normal })]);
    expect(week.cleared).toBe(0);
    expect(week.left).toBe(1);
    // Gate 1 cleared on Normal, gate 2 still to do at the clear's difficulty.
    expect(week.possible).toBe(13000 + 19000);
    // Normal is half roster-bound: none of it is character-bound.
    expect(week.possibleShared).toBe(32000);
  });
});
