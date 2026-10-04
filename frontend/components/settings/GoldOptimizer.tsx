"use client";

import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { useUndo } from "@/components/Toast";
import { Account, Character, formatGold, MAX_GOLD_EARNERS, send, Task } from "@/lib/api";
import {
  AccountSetup,
  applyChanges,
  BOUND_VALUES,
  BoundValue,
  Change,
  RaidPick,
  suggestGoldSetup,
  undoChanges,
} from "@/lib/optimizer";
import { formatItemLevel, formatShortGold } from "@/lib/raids";
import { usePreference } from "@/lib/usePreference";

async function run(changes: Change[]) {
  for (const change of changes) await send(change.method, change.path, change.body);
}

function Picks({ picks }: { picks: RaidPick[] }) {
  if (picks.length === 0) return <span className="text-muted">no gold raids</span>;
  return (
    <span>
      {picks.map((p, i) => (
        <span key={p.task.id}>
          {i > 0 && ", "}
          {p.task.name} {p.difficulty.name}{" "}
          <span className="text-muted">{p.unknownGold ? "?" : formatShortGold(p.gold)}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * "Suggest my gold setup": the gold earners and raids that pay each account
 * the most, next to what's set up now, applied in one click (with Undo).
 */
export default function GoldOptimizer({
  characters,
  tasks,
  accounts,
  onApplied,
  onError,
}: {
  characters: Character[];
  tasks: Task[];
  accounts: Account[];
  onApplied: () => void;
  onError: (error: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [boundValue, setBoundValue] = usePreference<BoundValue>("optimizer-bound-value", 1, [1, 0.5, 0]);
  const [applying, setApplying] = useState<number | null>(null);
  const offerUndo = useUndo();
  const setups = open ? suggestGoldSetup(characters, tasks, boundValue) : [];
  const accountName = (id: number) => accounts.find((a) => a.id === id)?.name ?? "Account";

  async function apply(setup: AccountSetup) {
    const rows = setup.rows.filter((r) => r.changed);
    setApplying(setup.accountId);
    try {
      for (const row of rows) await run(applyChanges(row, tasks));
      offerUndo(`Applied the suggested gold setup${accounts.length > 1 ? ` on ${accountName(setup.accountId)}` : ""}`, async () => {
        for (const row of rows) await run(undoChanges(row, tasks));
        onApplied();
      });
    } catch (e) {
      onError(describeError(e));
    }
    setApplying(null);
    onApplied();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        <Sparkles size={16} className="text-accent" /> Suggest my gold setup
      </button>
    );
  }

  return (
    <section className="mb-4 rounded-lg border border-accent/40 bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles size={16} className="text-accent" /> Suggested gold setup
          </h2>
          <p className="max-w-2xl text-xs text-muted">
            For each account: the {MAX_GOLD_EARNERS} characters and 3 raids each that pay the most per week, at the best difficulty
            they can enter. Event raids aren&apos;t counted (they pay anyone). Unknown gold (?) counts as 0.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            Bound gold
            <select value={boundValue} onChange={(e) => setBoundValue(Number(e.target.value) as BoundValue)} className="py-0.5 text-xs">
              {BOUND_VALUES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>
      </div>

      {setups.length === 0 && <p className="text-sm text-muted">Add characters first.</p>}

      <div className="space-y-4">
        {setups.map((setup) => {
          const changed = setup.rows.filter((r) => r.changed);
          const gain = setup.suggestedValue - setup.currentValue;
          return (
            <div key={setup.accountId} className="rounded-md border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm">
                <span>
                  {accounts.length > 1 && <span className="mr-2 font-medium">{accountName(setup.accountId)}</span>}
                  <span className="tabular-nums text-muted">{formatGold(setup.currentValue)}</span>
                  <ArrowRight size={12} className="mx-1 inline text-muted" />
                  <span className="font-medium tabular-nums">{formatGold(setup.suggestedValue)}</span>
                  <span className="text-muted"> a week</span>
                  {gain > 0 && <span className="ml-2 font-medium text-done">+{formatGold(gain)}</span>}
                </span>
                {changed.length > 0 ? (
                  <button
                    onClick={() => apply(setup)}
                    disabled={applying !== null}
                    className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-background disabled:opacity-60"
                  >
                    {applying === setup.accountId ? "Applying…" : `Apply ${changed.length} change${changed.length === 1 ? "" : "s"}`}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-done">
                    <Check size={14} /> Already the best setup
                  </span>
                )}
              </div>
              {changed.length > 0 && (
                <ul className="divide-y divide-border text-sm">
                  {changed.map((row) => (
                    <li key={row.character.id} className="px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">
                          {row.character.name}{" "}
                          <span className="text-xs font-normal text-muted">{formatItemLevel(row.character.item_level)}</span>
                          {row.earnerNow !== row.earnerSuggested && (
                            <span className={`ml-2 rounded px-1.5 text-[11px] ${row.earnerSuggested ? "bg-done/15 text-done" : "bg-danger/10 text-danger"}`}>
                              {row.earnerSuggested ? "becomes a gold earner" : "stops earning gold"}
                            </span>
                          )}
                        </span>
                        <span className="text-xs tabular-nums text-muted">
                          {formatGold(row.currentValue)} <ArrowRight size={10} className="inline" /> {formatGold(row.suggestedValue)}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted">Now: </span>
                        <Picks picks={row.current} />
                      </div>
                      {row.earnerSuggested && (
                        <div className="text-xs">
                          <span className="text-muted">Suggested: </span>
                          <Picks picks={row.suggested} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        Applying sets who earns gold and makes each gold earner&apos;s usual raids exactly the suggested ones;
        characters who stop earning gold keep their raids. You can undo it right after.
      </p>
    </section>
  );
}
