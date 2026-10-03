"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { api, BalanceCheck, Character, ExpectedBalances, formatGold, parseUtc, send } from "@/lib/api";

// Character-bound gold comes from Horizon Cathedral, which starts at 1700.
const CHARACTER_BOUND_ITEM_LEVEL = 1700;

/**
 * Enter the gold you have now. Each check-in is compared with what the app
 * expected from the previous one plus tracked gold since; the difference is
 * gold spent on things the app doesn't track (honing, the market, ...).
 */
export default function GoldCheckIn({
  characters,
  onChanged,
  onError,
}: {
  characters: Character[];
  onChanged: () => void;
  onError: (error: string) => void;
}) {
  const [checks, setChecks] = useState<BalanceCheck[]>([]);
  const [expected, setExpected] = useState<ExpectedBalances | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    Promise.all([api<BalanceCheck[]>("/balances"), api<ExpectedBalances | null>("/balances/expected")])
      .then(([checkData, expectedData]) => {
        setChecks(checkData);
        setExpected(expectedData);
        // Pre-fill with what should be on hand; you only fix what's off.
        const e = expectedData?.expected;
        setDraft({
          tradeable: e ? String(e.tradeable) : "",
          roster_bound: e ? String(e.roster_bound) : "",
          ...Object.fromEntries(Object.entries(e?.character_bound ?? {}).map(([id, gold]) => [id, String(gold)])),
        });
      })
      .catch((e) => onError(describeError(e)));
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const counted = expected?.expected.character_bound ?? {};
  const boundCharacters = characters.filter(
    (c) => c.item_level >= CHARACTER_BOUND_ITEM_LEVEL || String(c.id) in counted,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = (key: string) => Math.round(Number(draft[key]) || 0);
    const characterBound = Object.fromEntries(
      boundCharacters.filter((c) => (draft[c.id] ?? "").trim() !== "").map((c) => [c.id, number(String(c.id))]),
    );
    try {
      await send("POST", "/balances", {
        tradeable: number("tradeable"),
        roster_bound: number("roster_bound"),
        character_bound: characterBound,
        note: note.trim() || null,
      });
      setNote("");
      load();
      onChanged();
    } catch (e) {
      onError(describeError(e));
    }
  }

  async function remove(check: BalanceCheck) {
    if (!confirm("Delete this check-in?")) return;
    try {
      await send("DELETE", `/balances/${check.id}`);
      load();
      onChanged();
    } catch (e) {
      onError(describeError(e));
    }
  }

  const field = (key: string, label: string, hint?: string) => (
    <label key={key} className="flex flex-col gap-1 text-xs text-muted" title={hint}>
      {label}
      <input
        type="number"
        min="0"
        required={key === "tradeable" || key === "roster_bound"}
        value={draft[key] ?? ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        className="w-32 text-sm text-foreground"
      />
    </label>
  );
  const nameOf = (id: string) => characters.find((c) => String(c.id) === id)?.name ?? "Deleted character";

  return (
    <section id="check-in" className="scroll-mt-4 rounded-md border border-border bg-surface p-4">
      <h2 className="font-semibold">Gold on hand</h2>
      <p className="mt-1 mb-3 max-w-3xl text-xs text-muted">
        Enter the gold you have now, at least once a week (right after the Wednesday reset works well). The app
        compares it with your last check-in plus the gold it tracked since, and the difference is what you spent
        on things it doesn&apos;t track. Check in more often to see where it went.
        {expected && (
          <>
            {" "}
            The boxes are filled with what you should have since your last check-in on{" "}
            {parseUtc(expected.last_check_in).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
          </>
        )}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <div className="flex flex-wrap items-end gap-3">
          {field("tradeable", "Tradeable")}
          {field("roster_bound", "Roster-bound")}
        </div>
        {boundCharacters.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-muted">Character-bound (leave blank to skip a character)</div>
            <div className="flex flex-wrap items-end gap-3">
              {boundCharacters.map((c) => field(String(c.id), c.name))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <input placeholder="Note (optional), e.g. honed weapon" value={note} onChange={(e) => setNote(e.target.value)} className="w-72" />
          <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
            Save check-in
          </button>
        </div>
      </form>

      {checks.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-1.5 font-medium">When</th>
                <th className="py-1.5 text-right font-medium">Tradeable</th>
                <th className="py-1.5 text-right font-medium">Roster-bound</th>
                <th className="py-1.5 text-right font-medium">Character-bound</th>
                <th className="py-1.5 text-right font-medium" title="Expected minus what you had: gold spent on untracked things">
                  Untracked spending
                </th>
                <th className="py-1.5 pl-3 font-medium">Note</th>
                <th />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {checks.map((check) => {
                const characterTotal = check.actual.total - check.actual.tradeable - check.actual.roster_bound;
                const untracked = check.untracked;
                return (
                  <tr key={check.id} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 text-muted">
                      {parseUtc(check.checked_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="py-1.5 text-right">{formatGold(check.actual.tradeable)}</td>
                    <td className="py-1.5 text-right">{formatGold(check.actual.roster_bound)}</td>
                    <td
                      className="py-1.5 text-right"
                      title={Object.entries(check.actual.character_bound)
                        .map(([id, gold]) => `${nameOf(id)}: ${formatGold(gold)}`)
                        .join("\n")}
                    >
                      {formatGold(characterTotal)}
                    </td>
                    <td
                      className={`py-1.5 text-right ${untracked && untracked.total > 0 ? "font-medium text-accent" : "text-muted"}`}
                      title={
                        untracked
                          ? `Tradeable ${formatGold(untracked.tradeable)}, roster-bound ${formatGold(untracked.roster_bound)}` +
                            Object.entries(untracked.character_bound)
                              .map(([id, gold]) => `, ${nameOf(id)} ${formatGold(gold)}`)
                              .join("")
                          : "First check-in: nothing to compare with yet"
                      }
                    >
                      {untracked ? formatGold(untracked.total) : "–"}
                    </td>
                    <td className="py-1.5 pl-3 text-muted">{check.note}</td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => remove(check)} aria-label="Delete check-in" className="rounded px-1.5 text-danger hover:bg-danger/10">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            A negative number means you had more than expected, e.g. gold from a friend or something you didn&apos;t log.
          </p>
        </div>
      )}
    </section>
  );
}
