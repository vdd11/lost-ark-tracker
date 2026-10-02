"use client";

import { useEffect, useRef, useState } from "react";

import { Character, Difficulty, formatGems, gemsToLv1, Run, Task } from "@/lib/api";
import { formatItemLevel } from "@/lib/raids";

export type RunChanges = { count?: number; lucky_rooms?: number; mega_rooms?: number; sands?: number };

const MAX_SANDS = 5;

/**
 * Weekly content with tiers and gem rewards: Ebony Cube (a run counter, since
 * runs depend on tickets) and Haal's Hourglass (once a week, scaled by Sands
 * of Trial). The tier label opens the week's details: sands and lucky rooms.
 */
export default function ContentCell({
  task,
  character,
  tier,
  run,
  onChange,
  onRemove,
}: {
  task: Task;
  character: Character;
  tier: Difficulty | undefined;
  run: Run | undefined;
  onChange: (changes: RunChanges) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const count = run?.count ?? 0;
  const done = task.counted ? count > 0 : Boolean(run);
  const label = `${task.name} for ${character.name}`;

  // Close on outside click, Escape, or scroll (the popover is fixed-positioned).
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event.type === "mousedown" && popoverRef.current?.contains(event.target as Node)) return;
      if (event.type === "mousedown" && buttonRef.current?.contains(event.target as Node)) return;
      setOpen(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggleDetails() {
    if (open) return setOpen(null);
    const rect = buttonRef.current!.getBoundingClientRect();
    setOpen({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left + rect.width / 2 - 120, window.innerWidth - 248)) });
  }

  const extras = [
    task.sand_scaled && run?.sands ? `×${run.sands + 1}` : null,
    run?.lucky_rooms ? `L${run.lucky_rooms}` : null,
    run?.mega_rooms ? `M${run.mega_rooms}` : null,
  ].filter(Boolean);
  const stepper = "h-6 w-6 rounded text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30";

  return (
    <div className={done ? "bg-done/15" : ""}>
      <div className="flex h-7 items-end justify-center gap-1">
        {task.counted ? (
          <>
            <button onClick={() => onChange({ count: count - 1 })} disabled={count === 0} aria-label={`One fewer ${label} run`} className={stepper}>
              −
            </button>
            <span className="min-w-4 pb-0.5 tabular-nums" aria-label={`${count} ${label} runs`}>{count}</span>
            <button onClick={() => onChange({ count: count + 1 })} aria-label={`One more ${label} run`} className={stepper}>
              +
            </button>
          </>
        ) : (
          <input
            type="checkbox"
            checked={done}
            onChange={() => (done ? onRemove() : onChange({}))}
            aria-label={label}
            className="h-4 w-4 cursor-pointer"
          />
        )}
      </div>
      <button
        ref={buttonRef}
        onClick={toggleDetails}
        aria-expanded={Boolean(open)}
        aria-label={`${label}: ${tier?.name ?? ""} details`}
        className="mx-auto mb-1 block rounded px-1 py-0.5 text-[11px] leading-none text-muted hover:bg-surface-2"
      >
        {tier?.name ?? "—"}
        {extras.length > 0 && <span className="text-accent"> · {extras.join(" ")}</span>}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`${label} details`}
          style={{ top: open.top, left: open.left }}
          className="fixed z-30 w-60 rounded-md border border-border bg-surface p-3 text-left text-sm shadow-lg"
        >
          <div className="mb-2 font-medium">
            {task.name}
            {tier && <span className="font-normal text-muted"> · {tier.name} ({formatItemLevel(tier.min_item_level)})</span>}
          </div>

          {!done ? (
            <p className="text-xs text-muted">
              {task.counted ? "Add a run first" : "Check it off first"}, then log Sands of Trial and lucky rooms here.
            </p>
          ) : (
            <div className="space-y-2">
              {task.sand_scaled && (
                <label className="flex items-center justify-between gap-2">
                  <span>Sands of Trial</span>
                  <select
                    value={run?.sands ?? 0}
                    onChange={(e) => onChange({ sands: Number(e.target.value) })}
                    className="px-1.5 py-0.5"
                  >
                    {Array.from({ length: MAX_SANDS + 1 }, (_, n) => (
                      <option key={n} value={n}>{n} (×{n + 1})</option>
                    ))}
                  </select>
                </label>
              )}
              <Stepper label="Lucky rooms" value={run?.lucky_rooms ?? 0} onChange={(n) => onChange({ lucky_rooms: n })} />
              <Stepper label="Mega lucky rooms" value={run?.mega_rooms ?? 0} onChange={(n) => onChange({ mega_rooms: n })} />
              <div className="border-t border-border pt-2 text-xs text-muted">
                Expected gems:{" "}
                {run?.gems ? (
                  <>
                    <span className="font-medium text-foreground">{formatGems(gemsToLv1(run.gems))}</span> Lv1-eq (
                    {Object.entries(run.gems)
                      .map(([level, n]) => `${formatGems(n)}× Lv${level}`)
                      .join(", ")}
                    )
                  </>
                ) : (
                  "not set for this tier yet (see Gems page)"
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const button = "h-6 w-6 rounded border border-border text-muted hover:bg-surface-2 disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(value - 1)} disabled={value === 0} aria-label={`Fewer ${label.toLowerCase()}`} className={button}>
          −
        </button>
        <span className="w-4 text-center tabular-nums">{value}</span>
        <button onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`} className={button}>
          +
        </button>
      </div>
    </div>
  );
}
