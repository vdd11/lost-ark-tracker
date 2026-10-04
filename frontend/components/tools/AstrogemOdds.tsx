"use client";

import { useState } from "react";

import { OddsSettings } from "@/lib/astrogemSession";
import { BUILT_IN_GRADES, BUILT_IN_OPTIONS, Grade, ODDS_CHECKED } from "@/lib/data/astrogems";

/** The odds and rules the advice uses: every value editable, with Reset to built-in. */
export default function AstrogemOdds({ raw, odds, onChange }: { raw: string; odds: OddsSettings; onChange: (raw: string) => void }) {
  const [open, setOpen] = useState(false);
  const edited = raw !== "";
  const save = (next: OddsSettings) => onChange(JSON.stringify(next));
  const sum = Object.values(odds.weights).reduce((s, w) => s + w, 0);

  return (
    <section className="rounded-md border border-border bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOpen(!open)} className="font-medium underline">
          {open ? "Hide" : "Show"} the odds and rules used
        </button>
        {edited && <span className="text-xs text-accent">edited</span>}
        {edited && (
          <button onClick={() => onChange("")} className="ml-auto rounded-md border border-border px-2.5 py-1 hover:bg-surface-2">
            Reset to built-in
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">
            Option weights and the 25% pick: Smilegate&apos;s official probability disclosure (Korea, updated 2025-08-20).
            Refreshes by grade and grade thresholds: official NA &ldquo;Day of Prophecy&rdquo; notes (2025-11-19). Attempts by grade and
            900 gold per attempt: Maxroll&apos;s Ark Grid guide (community, June 2026). Assumed: the 4 options are different
            options drawn by weight; refreshing is free; the cost modifier goes between −100% and +100%. Checked {ODDS_CHECKED}.
            If NA&apos;s numbers differ, change them here.
          </p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(BUILT_IN_GRADES) as Grade[]).map((g) => (
              <span key={g} className="flex items-center gap-1">
                {BUILT_IN_GRADES[g].label}:
                <input
                  type="number"
                  min={1}
                  value={odds.grades[g].attempts}
                  onChange={(e) => save({ ...odds, grades: { ...odds.grades, [g]: { ...odds.grades[g], attempts: Math.max(1, Math.round(Number(e.target.value))) } } })}
                  aria-label={`${BUILT_IN_GRADES[g].label} attempts`}
                  className="w-12 text-right"
                />
                attempts,
                <input
                  type="number"
                  min={0}
                  value={odds.grades[g].refreshes}
                  onChange={(e) => save({ ...odds, grades: { ...odds.grades, [g]: { ...odds.grades[g], refreshes: Math.max(0, Math.round(Number(e.target.value))) } } })}
                  aria-label={`${BUILT_IN_GRADES[g].label} refreshes`}
                  className="w-12 text-right"
                />
                refreshes
              </span>
            ))}
            <label className="flex items-center gap-1">
              Gold per attempt
              <input type="number" min={0} value={odds.baseCost} onChange={(e) => save({ ...odds, baseCost: Math.max(0, Number(e.target.value)) })} aria-label="Gold per attempt" className="w-20 text-right" />
            </label>
          </div>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {BUILT_IN_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center justify-between gap-2">
                <span>{o.label}</span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={odds.weights[o.key]}
                    onChange={(e) => save({ ...odds, weights: { ...odds.weights, [o.key]: Math.max(0, Number(e.target.value)) } })}
                    aria-label={`${o.label} weight`}
                    className="w-20 text-right"
                  />
                  %
                </span>
              </label>
            ))}
          </div>
          <p className={`text-xs ${Math.abs(sum - 100) > 0.01 ? "text-accent" : "text-muted"}`}>
            Weights add up to {sum.toFixed(2)}% (they&apos;re relative, so a total other than 100 still works).
          </p>
        </div>
      )}
    </section>
  );
}
