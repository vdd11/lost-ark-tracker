import { Character, Difficulty, RestState, Run, Task } from "@/lib/api";

/** Small builders for component tests: only the fields that matter, sensible defaults for the rest. */

export function difficulty(id: number, name: string, minItemLevel: number, gold: number | null, extra: Partial<Difficulty> = {}): Difficulty {
  return {
    id, task_id: 1, name, position: id, min_item_level: minItemLevel, gold,
    catalog_item_level: minItemLevel, catalog_gold: gold, bound_percent: 0, catalog_bound_percent: 0,
    bound_kind: "roster", catalog_bound_kind: "roster", bonus_cost: null, catalog_bonus_cost: null, gate_gold: null, gate_bonus: null,
    reward_gems: null, lucky_gems: null, mega_gems: null, catalog_rewards: null, ...extra,
  };
}

export function task(extra: Partial<Task> = {}): Task {
  return {
    id: 1, name: "Serca", category: "raid", gold: 0, position: 0, rest_max: 0, rest_gain: 0, rest_cost: 0,
    catalog_key: null, archived: false, ends_on: null, roster_limited: false, gold_for_everyone: false,
    note: null, counted: false, sand_scaled: false, gate_count: 0, difficulties: [], ...extra,
  };
}

export function character(extra: Partial<Character> = {}): Character {
  return {
    id: 7, name: "Bardy", class_name: "Bard", item_level: 1735, is_gold_earner: true, position: 0,
    account_id: 1, azena_until: null, inanna_until: null, task_ids: [], difficulty_ids: {}, ...extra,
  };
}

export function run(extra: Partial<Run> = {}): Run {
  return {
    character_id: 7, task_id: 1, difficulty_id: null, count: 1, lucky_rooms: 0, mega_rooms: 0, sands: 0, fate_embers: 0, blessed_embers: 0,
    bought_bonus: false, bonus_spent: 0, tier_counts: null, gates: null, gems: null, ...extra,
  };
}

export function rest(extra: Partial<RestState> = {}): RestState {
  return { character_id: 7, task_id: 1, value: 40, rested_run_available: true, ...extra };
}
