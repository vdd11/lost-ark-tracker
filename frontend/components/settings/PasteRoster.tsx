"use client";

import { ClipboardPaste, X } from "lucide-react";
import { useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { suggestedRaids } from "@/components/RaidPicker";
import { AccountSelect } from "@/components/settings/controls";
import { Account, Character, MAX_GOLD_EARNERS, send, Task } from "@/lib/api";
import { LOST_ARK_CLASSES } from "@/lib/classes";
import { NEEDS_CLASS, parseRosterPaste, pickGoldEarners, withPickedClasses } from "@/lib/rosterPaste";

/**
 * Add several characters at once from pasted text: one per line with a name,
 * class and item level, in whatever order a spreadsheet or roster page gives
 * them. Shows what it read before adding anything.
 */
export default function PasteRoster({
  accounts,
  characters,
  raids,
  onDone,
  onError,
}: {
  accounts: Account[];
  characters: Character[];
  raids: Task[];
  onDone: () => void;
  onError: (error: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  // Classes picked in the preview, by pasted line (pages that show classes only as icons).
  const [picked, setPicked] = useState<Record<number, string>>({});

  const account = accountId ?? accounts[0]?.id ?? null;
  const parsed = parseRosterPaste(
    text,
    characters.map((c) => c.name),
  );
  const rows = withPickedClasses(parsed, picked);
  const needsClass = new Set(parsed.filter((row) => row.problem === NEEDS_CLASS).map((row) => row.line));
  const ready = rows.filter((row) => !row.problem);
  const earnersNow = characters.filter((c) => c.is_gold_earner && (account === null || c.account_id === account)).length;
  const goldEarners = pickGoldEarners(rows, MAX_GOLD_EARNERS - earnersNow);

  async function addAll() {
    setAdding(true);
    try {
      for (const row of ready) {
        const isGoldEarner = goldEarners.has(row.line);
        const picked = isGoldEarner ? suggestedRaids(raids, row.itemLevel) : {};
        await send("POST", "/characters", {
          name: row.name,
          class_name: row.className,
          item_level: row.itemLevel,
          is_gold_earner: isGoldEarner,
          account_id: account ?? undefined,
          raids: Object.entries(picked).map(([taskId, difficultyId]) => ({ task_id: Number(taskId), difficulty_id: difficultyId || null })),
        });
      }
      setText("");
      setPicked({});
      setOpen(false);
    } catch (e) {
      onError(describeError(e));
    } finally {
      setAdding(false);
      onDone();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        <ClipboardPaste size={14} /> Paste a roster
      </button>
    );
  }

  return (
    <section className="mb-4 rounded-md border border-border bg-surface p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <ClipboardPaste size={16} /> Paste a roster
        </h2>
        <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>
      <p className="mb-2 text-muted">
        One character per line with a name, class and item level, in any order: typed, or copied from a spreadsheet. Or
        select your whole roster on a page like lostark.bible and paste it: the other text on the page is skipped. Where
        the page shows classes only as icons, pick each class below. Nothing is looked up online. The highest item levels become gold earners (up to{" "}
        {MAX_GOLD_EARNERS} per account) with their best-paying raids; you can change any of it afterwards.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"Bardy Bard 1720\nSorcy, Sorceress, 1705.83\nTanky\tGunlancer\t1680"}
        aria-label="Characters to add"
        className="mb-2 w-full font-mono"
      />
      {rows.length > 0 && (
        <div className="mb-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 font-medium">Name</th>
              <th className="py-1 font-medium">Class</th>
              <th className="py-1 font-medium">Item level</th>
              <th className="py-1 font-medium">Will be</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.line} className={row.problem ? "text-muted" : ""}>
                <td className="py-0.5">{row.name || "?"}</td>
                <td className="py-0.5">
                  {needsClass.has(row.line) ? (
                    <select
                      value={picked[row.line] ?? ""}
                      onChange={(e) => setPicked({ ...picked, [row.line]: e.target.value })}
                      aria-label={`Class for ${row.name}`}
                      className="py-0.5 text-sm"
                    >
                      <option value="">Pick a class…</option>
                      {LOST_ARK_CLASSES.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    row.className || "?"
                  )}
                </td>
                <td className="py-0.5 tabular-nums">{row.itemLevel || "–"}</td>
                <td className="py-0.5">
                  {row.problem === NEEDS_CLASS ? (
                    <span className="text-muted">Pick a class</span>
                  ) : row.problem ? (
                    <span className="text-danger">
                      Skipped: {row.problem.toLowerCase()} (line {row.line})
                    </span>
                  ) : goldEarners.has(row.line) ? (
                    "Gold earner"
                  ) : (
                    "Added"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {accounts.length > 1 && account !== null && <AccountSelect accounts={accounts} value={account} onChange={setAccountId} label="Account" />}
        <button
          onClick={addAll}
          disabled={adding || ready.length === 0}
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-50"
        >
          {adding ? "Adding…" : `Add ${ready.length} character${ready.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </section>
  );
}
