/** Market prices the user types in (Tools → Prices), as GET /api/prices returns them. */
export type Price = {
  key: string;
  name: string;
  /** Gold for `per` units; null until set. */
  price: number | null;
  per: number;
  unit_price: number | null;
  hidden: boolean;
  builtin: boolean;
  tools: string[];
  updated_at: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
/** Prices older than this get a "may be out of date" note. */
export const STALE_AFTER_DAYS = 7;

/** "1,234.5" / "1234,5" / "" -> number or null. Commas before 3 digits are thousands. */
export function parsePrice(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const normalized = /,\d{3}(\D|$)/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** How long ago a price was set, for the table: "today", "3 days ago". */
export function priceAge(updatedAt: string | null, now: Date): { text: string; stale: boolean } | null {
  if (!updatedAt) return null;
  const then = new Date(updatedAt.endsWith("Z") ? updatedAt : `${updatedAt}Z`);
  const days = Math.floor((now.getTime() - then.getTime()) / DAY);
  const text = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return { text, stale: days >= STALE_AFTER_DAYS };
}

/**
 * Gold value of some materials at the user's prices. Items without a price
 * are listed as missing rather than counted as free.
 */
export function valueAt(amounts: Record<string, number>, prices: Price[]): { gold: number; missing: string[] } {
  const byKey = new Map(prices.map((p) => [p.key, p]));
  let gold = 0;
  const missing: string[] = [];
  for (const [key, amount] of Object.entries(amounts)) {
    if (!amount) continue;
    const unit = byKey.get(key)?.unit_price;
    if (unit == null) missing.push(byKey.get(key)?.name ?? key);
    else gold += unit * amount;
  }
  return { gold, missing };
}

/** A unit price for display: whole gold when it's big, up to 2 decimals when small. */
export function formatUnitPrice(value: number) {
  return value >= 100 ? Math.round(value).toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
