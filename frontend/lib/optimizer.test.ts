import { describe, expect, it } from "vitest";

import { Character, Difficulty, Task } from "./api";
import { applyChanges, bestPicks, difficultyValue, suggestGoldSetup, undoChanges } from "./optimizer";

let nextId = 1;
const tier = (taskId: number, name: string, ilvl: number, gold: number | null, boundPercent = 0): Difficulty =>
  ({ id: nextId++, task_id: taskId, name, position: 0, min_item_level: ilvl, gold, bound_percent: boundPercent }) as Difficulty;
function raid(name: string, tiers: [string, number, number | null, number?][], extra: Partial<Task> = {}): Task {
  const id = nextId++;
  return {
    id, name, category: "raid", archived: false, ends_on: null, gold_for_everyone: false, roster_limited: false,
    difficulties: tiers.map(([n, ilvl, gold, bound]) => tier(id, n, ilvl, gold, bound)), ...extra,
  } as Task;
}
function who(name: string, itemLevel: number, extra: Partial<Character> = {}): Character {
  return {
    id: nextId++, name, class_name: "Bard", item_level: itemLevel, is_gold_earner: false, position: nextId,
    account_id: 1, azena_until: null, innana_until: null, task_ids: [], difficulty_ids: {}, ...extra,
  };
}
const assigned = (tasks: [Task, string][]) => ({
  task_ids: tasks.map(([t]) => t.id),
  difficulty_ids: Object.fromEntries(tasks.map(([t, n]) => [String(t.id), t.difficulties.find((d) => d.name === n)!.id])),
});

const serca = raid("Serca", [["Normal", 1710, 32000, 50], ["Hard", 1730, 44000], ["Nightmare", 1740, 54000]]);
const cathedral = raid("Horizon Cathedral", [["Lv1", 1700, 30000, 100], ["Lv2", 1720, 40000, 100], ["Lv3", 1750, 50000, 100]]);
const finalDay = raid("The Final Day", [["Normal", 1710, 32000, 50], ["Hard", 1730, 48000]]);
const act4 = raid("Act 4", [["Normal", 1700, 27000], ["Hard", 1720, 38000]]);
const extreme = raid("Act 3 Extreme", [["Hard", 1700, 45000]], { gold_for_everyone: true, roster_limited: true });
const tasks = [serca, cathedral, finalDay, act4, extreme];

describe("valuing gold", () => {
  it("counts bound gold fully, half, or not at all", () => {
    const normal = serca.difficulties[0];
    expect([difficultyValue(normal, 1), difficultyValue(normal, 0.5), difficultyValue(normal, 0)]).toEqual([32000, 24000, 16000]);
  });
});

describe("bestPicks", () => {
  it("takes the 3 best-paying raids at the best difficulty the character can enter, never events", () => {
    const picks = bestPicks(who("Main", 1745), tasks, 1);
    expect(picks.map((p) => `${p.task.name} ${p.difficulty.name}`)).toEqual(["Serca Nightmare", "The Final Day Hard", "Horizon Cathedral Lv2"]);
  });

  it("prefers tradeable gold when bound gold doesn't count", () => {
    const picks = bestPicks(who("Alt", 1720), tasks, 0);
    // Cathedral is all character-bound and Normal raids half roster-bound.
    expect(picks.map((p) => `${p.task.name} ${p.difficulty.name}`)).toEqual(["Act 4 Hard", "Serca Normal", "The Final Day Normal"]);
  });
});

describe("suggestGoldSetup", () => {
  it("picks the 6 best characters per account as gold earners and shows the gain", () => {
    const roster = [
      who("Low", 1700, { is_gold_earner: true, ...assigned([[act4, "Normal"]]) }),
      ...Array.from({ length: 6 }, (_, i) => who(`High${i}`, 1745)),
    ];
    const [account] = suggestGoldSetup(roster, tasks, 1);
    const earners = account.rows.filter((r) => r.earnerSuggested).map((r) => r.character.name);
    expect(earners).toHaveLength(6);
    expect(earners).not.toContain("Low");
    expect(account.currentValue).toBe(27000);
    expect(account.suggestedValue).toBe(6 * (54000 + 48000 + 40000));
    expect(account.rows.find((r) => r.character.name === "Low")!.changed).toBe(true);
  });

  it("keeps each account separate and leaves an already-optimal setup unchanged", () => {
    const best = assigned([[serca, "Nightmare"], [finalDay, "Hard"], [cathedral, "Lv2"]]);
    const main = who("Main", 1745, { is_gold_earner: true, ...best });
    const alt = who("Alt", 1745, { account_id: 2 });
    const setups = suggestGoldSetup([main, alt], tasks, 1);
    expect(setups.map((s) => s.accountId)).toEqual([1, 2]);
    expect(setups[0].rows[0].changed).toBe(false);
    expect(setups[1].rows[0]).toMatchObject({ earnerNow: false, earnerSuggested: true, changed: true });
  });
});

describe("applying and undoing", () => {
  it("sets the earner flag and exactly the suggested raids, and can put it all back", () => {
    const character = who("Main", 1745, { is_gold_earner: false, ...assigned([[act4, "Hard"], [serca, "Hard"]]) });
    const [account] = suggestGoldSetup([character], tasks, 1);
    const row = account.rows[0];
    const changes = applyChanges(row, tasks);
    expect(changes).toEqual([
      { method: "PATCH", path: `/characters/${character.id}`, body: { is_gold_earner: true } },
      { method: "PUT", path: `/characters/${character.id}/tasks/${serca.id}`, body: { difficulty_id: serca.difficulties[2].id } },
      { method: "PUT", path: `/characters/${character.id}/tasks/${finalDay.id}`, body: { difficulty_id: finalDay.difficulties[1].id } },
      { method: "PUT", path: `/characters/${character.id}/tasks/${cathedral.id}`, body: { difficulty_id: cathedral.difficulties[1].id } },
      { method: "DELETE", path: `/characters/${character.id}/tasks/${act4.id}` },
    ]);
    expect(undoChanges(row, tasks)).toEqual([
      { method: "PATCH", path: `/characters/${character.id}`, body: { is_gold_earner: false } },
      { method: "PUT", path: `/characters/${character.id}/tasks/${serca.id}`, body: { difficulty_id: serca.difficulties[1].id } },
      { method: "DELETE", path: `/characters/${character.id}/tasks/${finalDay.id}` },
      { method: "DELETE", path: `/characters/${character.id}/tasks/${cathedral.id}` },
      { method: "PUT", path: `/characters/${character.id}/tasks/${act4.id}`, body: { difficulty_id: act4.difficulties[1].id } },
    ]);
  });
});
