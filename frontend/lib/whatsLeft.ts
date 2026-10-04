import { Character, Run, Task } from "./api";
import { difficultyOf, goldRaidWeek, raidGold, topGoldRaids } from "./raids";
import { cellKey } from "./trackerSections";
import { remainingFor } from "./trackerView";

export type LeftItem = {
  task: Task;
  /** The difficulty (raids) or tier (Hourglass) they'd run. */
  tierName?: string;
  /** Gold it would still pay; 0 when it won't pay (a raid past the 3 paid ones). */
  gold: number;
  /** False for a raid that won't pay this week. */
  paying: boolean;
  /** The gold value isn't known yet (shown as ?). */
  unknownGold: boolean;
  /**
   * Not one of their usual raids: the best one they can enter, filling a paid
   * slot their usual raids don't (as "Gold raids left" counts it).
   */
  suggested?: boolean;
};

export type LeftGroup = { character: Character; items: LeftItem[]; gold: number };

/**
 * What each character still has to do in the given columns (their usual tasks,
 * like "All" ticks), richest first. Raids come first, by gold; only as many as
 * the character has paid slots left count as paying. A gold earner with fewer
 * usual raids than slots also gets the best raids they can enter, marked as
 * suggested, matching the "Gold raids left" count.
 */
export function whatsLeft({
  roster,
  columns,
  tasks,
  completed,
  runs,
}: {
  roster: Character[];
  columns: Task[];
  tasks: Task[];
  completed: Set<string>;
  runs: Run[];
}): LeftGroup[] {
  const groups = roster.map((character) => {
    const todo = remainingFor(character, columns, (t) => completed.has(cellKey(character.id, t.id)));
    let paidSlots = goldRaidWeek(character, tasks, runs).left;

    const raids = todo
      .filter((t) => t.category === "raid")
      .map((task) => ({ task, value: raidGold(character, task) }))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map(({ task, value }): LeftItem => {
        const paying = task.gold_for_everyone || (character.is_gold_earner && paidSlots > 0);
        if (paying && !task.gold_for_everyone) paidSlots -= 1;
        return {
          task,
          tierName: difficultyOf(character, task)?.name,
          gold: paying ? (value ?? 0) : 0,
          paying,
          unknownGold: paying && value === null,
        };
      });

    // Paid slots their usual raids don't fill: suggest the best other raids they can enter.
    if (paidSlots > 0) {
      const ran = new Set(runs.filter((r) => r.character_id === character.id).map((r) => r.task_id));
      const candidates = columns.filter(
        (t) => t.category === "raid" && !t.archived && !character.task_ids.includes(t.id) && !ran.has(t.id),
      );
      for (const { task, difficulty } of topGoldRaids(candidates, character.item_level, paidSlots)) {
        raids.push({
          task,
          tierName: difficulty.name,
          gold: difficulty.gold ?? 0,
          paying: true,
          unknownGold: difficulty.gold === null,
          suggested: true,
        });
      }
    }

    const others = todo
      .filter((t) => t.category !== "raid")
      .map(
        (task): LeftItem => ({
          task,
          tierName: task.difficulties.length ? difficultyOf(character, task)?.name : undefined,
          gold: task.gold,
          paying: task.gold > 0,
          unknownGold: false,
        }),
      )
      .sort((a, b) => b.gold - a.gold);

    const items = [...raids, ...others];
    return { character, items, gold: items.reduce((sum, item) => sum + item.gold, 0) };
  });
  // Stable sort: ties keep roster order.
  return groups.filter((g) => g.items.length > 0).sort((a, b) => b.gold - a.gold);
}

/** "Serca Nightmare" (full names: "NM" means Normal to some players and Nightmare to others). */
export function itemName(item: LeftItem) {
  return item.tierName ? `${item.task.name} ${item.tierName}` : item.task.name;
}

/** A Discord-friendly summary, one line per character. */
export function whatsLeftText(groups: LeftGroup[]) {
  return groups.map((g) => `${g.character.name}: ${g.items.map(itemName).join(", ")}`).join("\n");
}
