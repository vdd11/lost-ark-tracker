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
};

export type Task = {
  id: number;
  name: string;
  category: TaskCategory;
  gold: number;
  position: number;
};

export type TrackerState = {
  daily_period: string;
  weekly_period: string;
  next_daily_reset: string;
  next_weekly_reset: string;
  completed: [number, number][];
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
