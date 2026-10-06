"use client";

import { Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import NumberInput from "@/components/NumberInput";
import { useUndo } from "@/components/Toast";
import { api, API_URL, Character, formatGold, parseUtc, send } from "@/lib/api";
import {
  canUseBoundGold,
  categoryLabel,
  defaultPaidFrom,
  PaidFrom,
  SPENDING_CATEGORIES,
  SpendingCategory,
  SpendingEntry,
  spendingBody,
  totalsSince,
} from "@/lib/spending";
import GameIcon from "@/components/GameIcon";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Gold spent on honing, gems, the market or anything else. Check-ins count
 * it, so "untracked spending" there is only what wasn't logged here.
 */
export default function SpendingLog({
  characters,
  accountId,
  onChanged,
  onError,
}: {
  characters: Character[];
  /** The account tab shown, or 0 for all. */
  accountId: number;
  onChanged: () => void;
  onError: (error: string) => void;
}) {
  const [entries, setEntries] = useState<SpendingEntry[]>([]);
  const [category, setCategory] = useState<SpendingCategory>("honing");
  const [amount, setAmount] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [paidFrom, setPaidFrom] = useState<PaidFrom>("bound_first");
  const [note, setNote] = useState("");
  const [now] = useState(() => Date.now());
  const offerUndo = useUndo();

  const load = useCallback(() => {
    api<SpendingEntry[]>(`/spending?limit=200${accountId ? `&account_id=${accountId}` : ""}`)
      .then(setEntries)
      .catch((e) => onError(describeError(e)));
  }, [accountId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      onError(describeError(e));
    }
    load();
    onChanged();
  }

  function changeCategory(next: SpendingCategory) {
    setCategory(next);
    setPaidFrom(defaultPaidFrom(next));
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const gold = Number(amount);
    if (!gold) return;
    run(() =>
      send("POST", "/spending", {
        category,
        amount: gold,
        paid_from: paidFrom,
        character_id: characterId ? Number(characterId) : null,
        account_id: characterId ? null : accountId || null,
        note: note.trim() || null,
      }),
    );
    setAmount("");
    setNote("");
  }

  function remove(entry: SpendingEntry) {
    run(async () => {
      await send("DELETE", `/spending/${entry.id}`);
      offerUndo(`${formatGold(entry.amount)} ${categoryLabel(entry.category).toLowerCase()} spending deleted`, async () => {
        await send("POST", "/spending", spendingBody(entry));
        load();
        onChanged();
      });
    });
  }

  const name = (id: number | null) => characters.find((c) => c.id === id)?.name ?? "";
  const month = totalsSince(entries, new Date(now - 30 * DAY));
  const monthTotal = Object.values(month).reduce((sum, value) => sum + value, 0);

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <GameIcon name="spending" size={20} alt="" /> Spending
        </h2>
        <a href={`${API_URL}/export/spending.csv`} download className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
          Export CSV
        </a>
      </div>
      <p className="mb-3 text-xs text-muted">
        Log gold you spend so check-ins can tell it apart from gold that went missing. Market purchases use tradeable
        gold; anything else uses the character&apos;s bound gold first, then roster-bound, then tradeable, unless you choose
        tradeable only.
      </p>

      <form onSubmit={add} className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <select value={category} onChange={(e) => changeCategory(e.target.value as SpendingCategory)} aria-label="Category">
          {SPENDING_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <NumberInput value={amount} onChange={setAmount} placeholder="Gold" aria-label="Gold spent" className="w-32" required />
        <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} aria-label="Character">
          <option value="">No character</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={paidFrom}
          onChange={(e) => setPaidFrom(e.target.value as PaidFrom)}
          disabled={!canUseBoundGold(category)}
          aria-label="Paid with"
        >
          <option value="bound_first">Bound gold first</option>
          <option value="tradeable">Tradeable only</option>
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={200} aria-label="Note" />
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
          Log spending
        </button>
      </form>

      {monthTotal > 0 && (
        <p className="mb-2 text-sm">
          Last 30 days: <span className="font-semibold tabular-nums">{formatGold(monthTotal)}</span>
          <span className="text-muted">
            {" "}
            ({SPENDING_CATEGORIES.filter((c) => month[c.key] > 0)
              .map((c) => `${c.label} ${formatGold(month[c.key])}`)
              .join(", ")})
          </span>
        </p>
      )}

      {entries.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {entries.slice(0, 10).map((entry) => (
              <tr key={entry.id} className="border-t border-border">
                <td className="py-1 pr-2 text-muted">{parseUtc(entry.spent_at).toLocaleDateString()}</td>
                <td className="py-1 pr-2">{categoryLabel(entry.category)}</td>
                <td className="py-1 pr-2">{name(entry.character_id)}</td>
                <td className="py-1 pr-2 text-muted">{entry.note}</td>
                <td className="py-1 pr-2 text-right tabular-nums">−{formatGold(entry.amount)}</td>
                <td className="py-1 text-right">
                  <button onClick={() => remove(entry)} aria-label="Delete" className="rounded p-1 text-muted hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
