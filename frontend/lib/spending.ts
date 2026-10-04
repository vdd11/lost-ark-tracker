/** Logged spending (Gold page → Spending), as GET /api/spending returns it. */
export type SpendingCategory = "honing" | "gems" | "market" | "other";
export type PaidFrom = "bound_first" | "tradeable";

export type SpendingEntry = {
  id: number;
  category: SpendingCategory;
  amount: number;
  paid_from: PaidFrom;
  character_id: number | null;
  account_id: number | null;
  note: string | null;
  spent_at: string;
};

export const SPENDING_CATEGORIES: { key: SpendingCategory; label: string }[] = [
  { key: "honing", label: "Honing" },
  { key: "gems", label: "Gems" },
  { key: "market", label: "Market" },
  { key: "other", label: "Other" },
];

export const categoryLabel = (key: SpendingCategory) => SPENDING_CATEGORIES.find((c) => c.key === key)?.label ?? key;

/** Market purchases can only use tradeable gold; anything else uses bound gold first by default. */
export function defaultPaidFrom(category: SpendingCategory): PaidFrom {
  return category === "market" ? "tradeable" : "bound_first";
}

export function canUseBoundGold(category: SpendingCategory) {
  return category !== "market";
}

/** The request body to log (or re-log, for Undo) an entry. */
export function spendingBody(entry: SpendingEntry) {
  return {
    category: entry.category,
    amount: entry.amount,
    paid_from: entry.paid_from,
    character_id: entry.character_id,
    account_id: entry.account_id,
    note: entry.note,
    spent_at: entry.spent_at,
  };
}

/** Totals per category for entries at or after `since` (UTC ISO strings from the API). */
export function totalsSince(entries: SpendingEntry[], since: Date): Record<SpendingCategory, number> {
  const totals: Record<SpendingCategory, number> = { honing: 0, gems: 0, market: 0, other: 0 };
  for (const entry of entries) {
    const at = new Date(entry.spent_at.endsWith("Z") ? entry.spent_at : `${entry.spent_at}Z`);
    if (at >= since) totals[entry.category] += entry.amount;
  }
  return totals;
}
