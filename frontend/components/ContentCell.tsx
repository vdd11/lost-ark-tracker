"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Character, Difficulty, formatCombinedGems, formatGems, gemsToLv1, Run, Task } from "@/lib/api";
import { formatItemLevel } from "@/lib/raids";

export type RunChanges = {
  /** Runs at the character's own tier. */
  count?: number;
  /** Runs at any tier, {difficulty_id: runs}. */
  tier_counts?: Record<number, number>;
  lucky_rooms?: number;
  mega_rooms?: number;
  sands?: number;
};

const MAX_SANDS = 5;
const POPOVER_WIDTH = 288;

/**
 * Weekly content with tiers and gem rewards: Ebony Cube (a run counter, since
 * runs depend on tickets) and Haal's Hourglass (once a week, scaled by Sands
 * of Trial). The cell's +/- counts the character's own tier; the tier label
 * opens the week's details: other tiers' tickets, sands and lucky rooms.
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
  // Where the details popover sits; `below` is the trigger's bottom edge and
  // `above` its top, so it can flip up when there's no room underneath.
  const [open, setOpen] = useState<{ top: number; left: number; above: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const count = run?.count ?? 0;
  const done = task.counted ? count > 0 : Boolean(run);
  const runsAt = (difficulty: Difficulty) =>
    run?.tier_counts ? (run.tier_counts[String(difficulty.id)] ?? 0) : difficulty.id === tier?.id ? count : 0;
  // Own-tier tickets (Kurzan Front / Chaos Rift); the rest are lower unlocks (guild shop).
  const ownCount = tier ? runsAt(tier) : count;
  const otherRuns = count - ownCount;
  const enterable = task.difficulties
    .filter((d) => d.min_item_level <= character.item_level || d.id === tier?.id)
    .sort((a, b) => a.min_item_level - b.min_item_level);
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
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16);
    setOpen({
      top: rect.bottom + 4,
      above: rect.top - 4,
      left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)),
    });
  }

  // Keep the whole popover on screen: flip above the button, or pin to the bottom.
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!open || !popover) return;
    const height = popover.offsetHeight;
    const room = window.innerHeight - 8;
    if (open.top + height <= room) return;
    const top = open.above - height >= 8 ? open.above - height : Math.max(8, room - height);
    if (top !== open.top) setOpen({ ...open, top });
  }, [open]);

  const extras = [
    task.counted && otherRuns > 0 ? `+${otherRuns}` : null,
    task.sand_scaled && run?.sands ? `×${run.sands + 1}` : null,
    run?.lucky_rooms ? `L${run.lucky_rooms}` : null,
    run?.mega_rooms ? `M${run.mega_rooms}` : null,
  ].filter(Boolean);
  const stepper =
    "flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30";

  return (
    <div className={`flex flex-col items-center gap-1.5 px-1 py-2 ${done ? "bg-done/15" : ""}`}>
      <div className="flex items-center justify-center gap-1.5">
        {task.counted ? (
          <>
            <button onClick={() => onChange({ count: ownCount - 1 })} disabled={ownCount === 0} aria-label={`One fewer ${label} run`} className={stepper}>
              <Minus size={14} />
            </button>
            <span className="min-w-5 text-center text-base font-medium tabular-nums" aria-label={`${ownCount} ${label} runs at ${tier?.name ?? "their"} unlock`}>
              {ownCount}
            </span>
            <button onClick={() => onChange({ count: ownCount + 1 })} aria-label={`One more ${label} run`} className={stepper}>
              <Plus size={14} />
            </button>
          </>
        ) : (
          <input
            type="checkbox"
            checked={done}
            onChange={() => (done ? onRemove() : onChange({}))}
            aria-label={label}
            className="h-5 w-5 cursor-pointer"
          />
        )}
      </div>
      <button
        ref={buttonRef}
        onClick={toggleDetails}
        aria-expanded={Boolean(open)}
        aria-label={`${label}: ${tier?.name ?? ""} details`}
        title={task.counted ? "Lower unlocks, lucky rooms" : "Sands of Trial, lucky rooms"}
        className="flex max-w-full items-center gap-0.5 truncate rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface-2 hover:text-foreground"
      >
        {tier ? (task.counted ? `${tier.name} unlock` : tier.name) : "—"}
        {extras.length > 0 && <span className="text-accent"> · {extras.join(" ")}</span>}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`${label} details`}
          style={{ top: open.top, left: open.left, width: `min(${POPOVER_WIDTH}px, calc(100vw - 16px))` }}
          className="fixed z-30 max-h-[calc(100vh-16px)] overflow-y-auto rounded-md border border-border bg-surface p-3 text-left text-sm shadow-lg"
        >
          <div className="mb-2 font-medium">
            {task.name}
            {tier && <span className="font-normal text-muted"> · {tier.name} ({formatItemLevel(tier.min_item_level)})</span>}
          </div>

          {task.counted && (
            <div className="mb-3 space-y-1.5">
              {enterable.map((difficulty) => (
                <Stepper
                  key={difficulty.id}
                  label={`${difficulty.name} unlock${difficulty.id === tier?.id ? " (yours)" : ""}`}
                  value={runsAt(difficulty)}
                  onChange={(n) =>
                    onChange(difficulty.id === tier?.id ? { count: n } : { tier_counts: { [difficulty.id]: n } })
                  }
                />
              ))}
              <p className="text-xs text-muted">
                Your unlock&apos;s tickets come from Kurzan Front / Chaos Rift. Guild shop boxes can give any unlock up to
                yours.
              </p>
            </div>
          )}

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
                    <span className="font-medium text-foreground">{formatCombinedGems(gemsToLv1(run.gems))}</span> (
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
