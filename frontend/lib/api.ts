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
  reserved_for: string | null;
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
};

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
  difficulties: Difficulty[];
};

export type Run = {
  character_id: number;
  task_id: number;
  difficulty_id: number | null;
  count: number;
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
  by_source: Record<string, number>;
};

export async function api<T = void>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ? JSON.stringify(body.detail) : `Request failed: ${response.status}`);
  }

  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function send<T = void>(method: string, path: string, body?: unknown) {
  return api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

// The API returns naive UTC datetimes, so mark them as UTC before parsing.
export function parseUtc(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

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
};

export type DifficultyDraft = { name: string; min_item_level: number; gold: number | null };

export type EventTemplate = { bases: string[]; difficulties: DifficultyDraft[] };
