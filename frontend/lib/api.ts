// Same-origin in the packaged app; .env.development points dev at uvicorn.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export type TaskCategory = "daily" | "weekly" | "raid";

export const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "daily", label: "Dailies" },
  { value: "weekly", label: "Weeklies" },
  { value: "raid", label: "Raids" },
];

export type Character = {
  id: number;
  name: string;
  class_name: string;
  item_level: number;
  is_gold_earner: boolean;
  position: number;
  task_ids: number[];
  /** task_id -> difficulty_id for raids (JSON object keys are strings). */
  difficulty_ids: Record<string, number>;
};

export type Difficulty = {
  id: number;
  task_id: number;
  name: string;
  position: number;
  min_item_level: number;
  /** Total gold for all gates; null when not known yet. */
  gold: number | null;
  catalog_item_level: number | null;
  catalog_gold: number | null;
  /** Share of the gold that's bound (character- or roster-bound), 0-100. */
  bound_percent: number;
  catalog_bound_percent: number | null;
  /** Whether bound gold is roster- or character-bound. */
  bound_kind: BoundKind;
  catalog_bound_kind: BoundKind | null;
  /** Gold to open every gate's bonus ("View More") chest; null = unknown. */
  bonus_cost: number | null;
  catalog_bonus_cost: number | null;
  /** Expected gems {level: count} per run / lucky room / mega lucky room; null = unknown. */
  reward_gems: GemTable | null;
  lucky_gems: GemTable | null;
  mega_gems: GemTable | null;
  catalog_rewards: Partial<Record<GemTableField, GemTable | null>> | null;
};

export type GemTable = Record<string, number>;
export type BoundKind = "roster" | "character";
export type GemTableField = "reward_gems" | "lucky_gems" | "mega_gems";

export type Task = {
  id: number;
  name: string;
  category: TaskCategory;
  gold: number;
  position: number;
  rest_max: number;
  rest_gain: number;
  rest_cost: number;
  catalog_key: string | null;
  archived: boolean;
  ends_on: string | null;
  roster_limited: boolean;
  gold_for_everyone: boolean;
  note: string | null;
  /** Tracked as a run count per period (Ebony Cube) instead of a checkbox. */
  counted: boolean;
  /** Rewards scale with Sands of Trial spent (Haal's Hourglass). */
  sand_scaled: boolean;
  difficulties: Difficulty[];
};

export type Run = {
  character_id: number;
  task_id: number;
  difficulty_id: number | null;
  count: number;
  lucky_rooms: number;
  mega_rooms: number;
  sands: number;
  bought_bonus: boolean;
  bonus_spent: number;
  /** Counted tasks: runs per tier, {difficulty_id: runs}. */
  tier_counts: Record<string, number> | null;
  /** Expected gems from this run. */
  gems: GemTable | null;
};

export type RestState = {
  character_id: number;
  task_id: number;
  value: number;
  rested_run_available: boolean;
};

export type TrackerState = {
  daily_period: string;
  weekly_period: string;
  next_daily_reset: string;
  next_weekly_reset: string;
  completed: [number, number][];
  runs: Run[];
  rest: RestState[];
};

export type GoldEntry = {
  id: number;
  source: string;
  amount: number;
  character_id: number | null;
  note: string | null;
  earned_at: string;
};

export type WeeklyGold = {
  week: string;
  raid_gold: number;
  other_gold: number;
  total: number;
  /** Part of raid_gold that's bound and can't be traded; character_bound_gold is the
   * character-bound share of it, the rest is roster-bound. */
  bound_gold: number;
  character_bound_gold: number;
  /** Gold spent on bonus chests; net = total - bonus_spent. */
  bonus_spent: number;
  net: number;
  /** Left after bonus chests, which spend the buyer's character-bound gold, then
   * roster-bound, then tradeable. */
  tradeable_left: number;
  roster_bound_left: number;
  character_bound_left: number;
  /** character_id -> that character's character-bound gold this week. */
  character_bound: Record<string, { earned: number; spent: number; left: number }>;
  /** Gold spent on untracked things, from this week's check-ins (null if none). */
  untracked_spent: number | null;
  by_source: Record<string, number>;
  by_character: Record<string, number>;
};

export async function api<T = void>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(errorMessage(body?.detail) ?? `Request failed: ${response.status}`);
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** FastAPI errors: a string, or a list of validation problems with a `msg` each. */
export function errorMessage(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : String(d)));
    return messages.join("; ") || null;
  }
  return null;
}

export function send<T = void>(method: string, path: string, body?: unknown) {
  return api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

// The API returns naive UTC datetimes, so mark them as UTC before parsing.
export function parseUtc(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

/** How many characters per roster can earn raid gold each week. */
export const MAX_GOLD_EARNERS = 6;

export function formatGold(amount: number) {
  return amount.toLocaleString();
}

/** Sort key used by every list that can be reordered. */
export function byPosition<T extends { position: number; id: number }>(a: T, b: T) {
  return a.position - b.position || a.id - b.id;
}

export type GemEntry = {
  id: number;
  source: string;
  character_id: number | null;
  /** Gem level (JSON key) -> count. */
  gems: Record<string, number>;
  note: string | null;
  earned_at: string;
};

export type WeeklyGems = {
  week: string;
  /** Level-1 equivalents: a level-n gem counts as 3^(n-1). */
  total: number;
  by_source: Record<string, number>;
  by_level: Record<string, number>;
  by_character: Record<string, number>;
};

export type DifficultyDraft = { name: string; min_item_level: number; gold: number | null };

export type EventTemplate = { bases: string[]; difficulties: DifficultyDraft[] };

/** Level-1 equivalents: three gems of a level combine into one of the next. */
export function gemsToLv1(gems: GemTable | null | undefined) {
  return Object.entries(gems ?? {}).reduce((sum, [level, count]) => sum + count * 3 ** (Number(level) - 1), 0);
}

/** How a week's gold splits by what you can do with it (logged gold counts as tradeable). */
export function goldSplit(week: WeeklyGold) {
  return {
    tradeable: week.total - week.bound_gold,
    roster: week.bound_gold - week.character_bound_gold,
    character: week.character_bound_gold,
  };
}

/**
 * Express gems as what they'd combine into: three of a level make one of the
 * next, so 15 Lv1 = one Lv3 and two Lv2. Fractions (from averages) stay at Lv1.
 */
export function combineGems(lv1Equivalent: number, maxLevel = 10): { level: number; count: number }[] {
  const result: { level: number; count: number }[] = [];
  let rest = lv1Equivalent;
  for (let level = maxLevel; level >= 1; level--) {
    const value = 3 ** (level - 1);
    const count = level === 1 ? Math.round(rest * 10) / 10 : Math.floor(rest / value + 1e-9);
    if (count > 0) result.push({ level, count });
    rest -= count * value;
  }
  return result;
}

export function formatCombinedGems(lv1Equivalent: number) {
  const parts = combineGems(lv1Equivalent);
  if (parts.length === 0) return "None";
  return parts.map(({ level, count }) => (count === 1 ? `Lv${level}` : `${formatGems(count)}× Lv${level}`)).join(" + ");
}

export function formatGems(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export type Balances = {
  tradeable: number;
  roster_bound: number;
  /** character_id -> gold */
  character_bound: Record<string, number>;
  total: number;
};

export type BalanceCheck = {
  id: number;
  checked_at: string;
  actual: Balances;
  note: string | null;
  /** From the previous check-in plus tracked gold since; null for the first. */
  expected: Balances | null;
  /** expected - actual: positive means gold went to untracked things. */
  untracked: Balances | null;
};

export type ExpectedBalances = { last_check_in: string; expected: Balances };
