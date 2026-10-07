"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

/**
 * A task done a number of times a period (Elysian: 5 a week): − n / limit +.
 * The number can be typed too, for big limits (Milestone Mission points).
 * Fixed width, so counting never moves anything.
 */
export default function LimitCounter({
  value,
  limit,
  label,
  onChange,
}: {
  value: number;
  limit: number;
  /** "Elysian for Bardy": names the buttons and the field. */
  label: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const set = (n: number) => onChange(Math.max(0, Math.min(limit, Math.round(n))));
  const button = "flex h-6 w-6 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 disabled:opacity-30";

  return (
    <div className="flex items-center gap-1 text-xs" role="group" aria-label={`${label}: ${value} of ${limit}`}>
      <button type="button" onClick={() => set(value - 1)} disabled={value === 0} aria-label={`One fewer for ${label}`} className={button}>
        <Minus size={12} />
      </button>
      <input
        inputMode="numeric"
        value={draft ?? String(value)}
        onFocus={(e) => {
          setDraft(String(value));
          e.target.select();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => {
          if (draft !== null && draft !== "" && Number(draft) !== value) set(Number(draft));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(null);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`${label} count`}
        className={`w-10 px-1 py-0.5 text-center tabular-nums ${value >= limit ? "font-medium text-done" : ""}`}
      />
      <span className="w-9 text-muted tabular-nums">/ {limit}</span>
      <button type="button" onClick={() => set(value + 1)} disabled={value >= limit} aria-label={`One more for ${label}`} className={button}>
        <Plus size={12} />
      </button>
    </div>
  );
}
