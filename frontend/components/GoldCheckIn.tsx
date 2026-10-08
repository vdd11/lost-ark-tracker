"use client";

import { Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import NumberInput from "@/components/NumberInput";
import { useUndo } from "@/components/Toast";
import { Account, api, BalanceCheck, Character, ExpectedBalances, formatGold, parseUtc, send } from "@/lib/api";
import { checkInBody } from "@/lib/undo";

// Character-bound gold comes from Horizon Cathedral, which starts at 1700.
const CHARACTER_BOUND_ITEM_LEVEL = 1700;

/**
 * Enter the gold you have now. Each check-in is compared with what the app
 * expected from the previous one plus tracked gold since; the difference is
 * gold spent on things the app doesn't track (honing, the market, ...).
 * Gold is per account in game, so each account checks in on its own.
 */
export default function GoldCheckIn({
  characters: allCharacters,
  accounts,
  accountId,
  onChanged,
  onError,
  refreshKey = 0,
}: {
  characters: Character[];
  accounts: Account[];
  /** Changes when something else (logged spending) moves the expected balance. */
  refreshKey?: number;
  /** The account the page shows; 0 is all of them. */
  accountId: number;
  onChanged: () => void;
  onError: (error: string) => void;
}) {
  const multiple = accounts.length > 1;
  // Viewing all accounts, pick which one this check-in is for.
  const [picked, setPicked] = useState<number | null>(null);
  const target = accountId || picked || accounts[0]?.id || 0;
  const characters = allCharacters.filter((c) => !multiple || c.account_id === target);
  const [checks, setChecks] = useState<BalanceCheck[]>([]);
  const offerUndo = useUndo();
  const [expected, setExpected] = useState<ExpectedBalances | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    if (!target) return;
    Promise.all([
      api<BalanceCheck[]>(`/balances${accountId ? `?account_id=${accountId}` : ""}`),
      api<ExpectedBalances | null>(`/balances/expected?account_id=${target}`),
    ])
      .then(([checkData, expectedData]) => {
        setChecks(checkData);
        setExpected(expectedData);
        // Pre-fill with what should be on hand; you only fix what's off.
        const e = expectedData?.expected;
        setDraft({
          tradeable: e ? String(e.tradeable) : "",
          roster_bound: e ? String(e.roster_bound) : "",
        });
      })
      .catch((e) => onError(describeError(e)));
  }, [onError, accountId, target, setDraft]);

  // refreshKey: reload when logged spending changes what's expected.
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const counted = expected?.expected.character_bound ?? {};
  const boundCharacters = characters.filter(
    (c) => c.item_level >= CHARACTER_BOUND_ITEM_LEVEL || String(c.id) in counted,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = (key: string) => Math.round(Number(draft[key]) || 0);
    try {
      await send("POST", "/balances", {
        tradeable: number("tradeable"),
        roster_bound: number("roster_bound"),
        note: note.trim() || null,
        account_id: target,
      });
      setNote("");
      load();
      onChanged();
    } catch (e) {
      onError(describeError(e));
    }
  }

  async function remove(check: BalanceCheck) {
    try {
      await send("DELETE", `/balances/${check.id}`);
      load();
      onChanged();
      offerUndo("Deleted the check-in", async () => {
        await send("POST", "/balances", checkInBody(check));
        load();
        onChanged();
      });
    } catch (e) {
      onError(describeError(e));
    }
  }

  const field = (key: string, label: string, hint?: string) => (
    <label key={key} className="flex flex-col gap-1 text-xs text-muted" title={hint}>
      {label}
      <NumberInput
        required={key === "tradeable" || key === "roster_bound"}
        value={draft[key] ?? ""}
        onChange={(digits) => setDraft({ ...draft, [key]: digits })}
        className="w-32 text-sm text-foreground"
      />
    </label>
  );
  const nameOf = (id: string) => allCharacters.find((c) => String(c.id) === id)?.name ?? "Deleted character";
  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? "";

  return (
    <section id="check-in" className="scroll-mt-4 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Gold on hand</h2>
        {multiple && !accountId && (
          <select value={target} onChange={(e) => setPicked(Number(e.target.value))} aria-label="Account to check in" className="py-0.5 text-sm">
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        )}
        {multiple && accountId > 0 && <span className="text-sm text-muted">{accountName(accountId)}</span>}
      </div>
      <p className="mt-1 mb-3 max-w-3xl text-xs text-muted">
        Enter the gold you have now{multiple ? " on this account" : ""}, at least once a week (right after the
        Wednesday reset works well). The app
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
          <p className="text-xs text-muted">
            Character-bound gold is set per character on the tracker (the gold chip under the name) and kept up to date
            from there.
          </p>
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
                {multiple && !accountId && <th className="py-1.5 pl-3 font-medium">Account</th>}
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
                    {multiple && !accountId && <td className="py-1.5 pl-3 text-muted">{accountName(check.account_id)}</td>}
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
                        <Trash2 size={14} />
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
