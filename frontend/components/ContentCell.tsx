"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { KeyboardEvent, useState } from "react";

import GameIcon from "@/components/GameIcon";
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
const TICKET_HELP =
  "Where tickets come from: your own unlock's from Kurzan Front and Chaos Rift; guild shop boxes can give any unlock up to yours.";

/**
 * Weekly content with tiers and gem rewards, right in the cell:
 * - Ebony Cube: `− n +` for the character's own unlock, then a ticket chip per
 *   unlock they can enter (click or + adds a ticket, its − or - removes one).
 * - Haal's Hourglass: the weekly checkbox and Sands of Trial as 0-5.
 * "Extras" opens lucky rooms, mega lucky rooms and the expected gems.
 * Everything has a fixed size, so logging a ticket never moves anything.
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
  const [extrasOpen, setExtrasOpen] = useState(false);
  const count = run?.count ?? 0;
  const done = task.counted ? count > 0 : Boolean(run);
  const runsAt = (difficulty: Difficulty) =>
    run?.tier_counts ? (run.tier_counts[String(difficulty.id)] ?? 0) : difficulty.id === tier?.id ? count : 0;
  // Own-unlock tickets (Kurzan Front / Chaos Rift); the rest are lower unlocks (guild shop).
  const ownCount = tier ? runsAt(tier) : count;
  const enterable = task.difficulties
    .filter((d) => d.min_item_level <= character.item_level || d.id === tier?.id)
    .sort((a, b) => a.min_item_level - b.min_item_level);
  const label = `${task.name} for ${character.name}`;
  const setRuns = (difficulty: Difficulty, n: number) =>
    onChange(difficulty.id === tier?.id ? { count: Math.max(0, n) } : { tier_counts: { [difficulty.id]: Math.max(0, n) } });
  const stepper =
    "flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30";

  return (
    <div className={`flex flex-col items-center gap-1.5 px-1 py-2 ${done ? "bg-done/15" : ""}`}>
      {task.counted ? (
        <>
          <div className="flex items-center justify-center gap-1.5">
            <GameIcon name="ebony-cube" size={20} alt="" />
            <button onClick={() => onChange({ count: ownCount - 1 })} disabled={ownCount === 0} aria-label={`One fewer ${label} run`} className={stepper}>
              <Minus size={14} />
            </button>
            <span className="min-w-5 text-center text-base font-medium tabular-nums" aria-label={`${ownCount} ${label} runs at ${tier?.name ?? "their"} unlock`}>
              {ownCount}
            </span>
            <button onClick={() => onChange({ count: ownCount + 1 })} aria-label={`One more ${label} run`} className={stepper}>
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1" role="group" aria-label={`${label}: tickets by unlock`}>
            {enterable.map((difficulty) => (
              <TicketChip
                key={difficulty.id}
                difficulty={difficulty}
                own={difficulty.id === tier?.id}
                value={runsAt(difficulty)}
                onChange={(n) => setRuns(difficulty, n)}
              />
            ))}
            <span
              tabIndex={0}
              role="note"
              className="flex h-6 w-5 cursor-help items-center justify-center rounded text-xs text-muted"
              title={TICKET_HELP}
              aria-label={TICKET_HELP}
            >
              ?
            </span>
          </div>
        </>
      ) : (
        <>
          <input
            type="checkbox"
            checked={done}
            onChange={() => (done ? onRemove() : onChange({}))}
            aria-label={label}
            className="h-5 w-5 cursor-pointer"
          />
          {task.sand_scaled && (
            <div
              role="radiogroup"
              aria-label={`${label}: Sands of Trial`}
              title={done ? "Sands of Trial spent: each adds another 100% of the rewards" : "Tick the run first"}
              className="flex items-center gap-px rounded-md border border-border p-px"
            >
              {Array.from({ length: MAX_SANDS + 1 }, (_, n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={(run?.sands ?? 0) === n}
                  aria-label={`${n} Sands of Trial`}
                  disabled={!done}
                  onClick={() => onChange({ sands: n })}
                  className={`h-5 w-4 rounded-sm text-xs tabular-nums disabled:opacity-40 ${
                    (run?.sands ?? 0) === n ? "bg-accent/25 font-semibold text-accent" : "text-muted hover:bg-surface-2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <button
        onClick={() => setExtrasOpen(!extrasOpen)}
        aria-expanded={extrasOpen}
        aria-label={`${label}: extras (lucky rooms)`}
        className={`flex items-center gap-0.5 rounded px-1 text-xs hover:text-foreground ${
          run?.lucky_rooms || run?.mega_rooms ? "text-accent" : "text-muted"
        }`}
      >
        Extras
        {run?.lucky_rooms ? ` · L${run.lucky_rooms}` : ""}
        {run?.mega_rooms ? ` · M${run.mega_rooms}` : ""}
        <ChevronDown size={12} className={extrasOpen ? "rotate-180" : ""} />
      </button>

      {extrasOpen && (
        <div className="w-full max-w-56 space-y-1.5 rounded-md border border-border bg-surface p-2 text-left text-xs">
          {!done ? (
            <p className="text-muted">{task.counted ? "Add a run first" : "Tick it first"}, then log lucky rooms here.</p>
          ) : (
            <>
              <Stepper label="Lucky rooms" value={run?.lucky_rooms ?? 0} onChange={(n) => onChange({ lucky_rooms: n })} />
              <Stepper label="Mega lucky rooms" value={run?.mega_rooms ?? 0} onChange={(n) => onChange({ mega_rooms: n })} />
              <p className="border-t border-border pt-1.5 text-muted">
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
                  "not known for this tier yet (see Gems page)"
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "2nd 1": tickets used at one unlock. Click or + adds, its − or - removes. */
function TicketChip({
  difficulty,
  own,
  value,
  onChange,
}: {
  difficulty: Difficulty;
  own: boolean;
  value: number;
  onChange: (value: number) => void;
}) {
  const perTicket = difficulty.reward_gems ? formatCombinedGems(gemsToLv1(difficulty.reward_gems)) : "?";
  const title = `${difficulty.name} unlock (${formatItemLevel(difficulty.min_item_level)}${own ? ", yours" : ""}): ${perTicket} in gems per ticket`;

  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    // Handled here, so the cell's own + and - (your unlock) don't also fire.
    if (event.key === "+" || event.key === "=") onChange(value + 1);
    else if (event.key === "-" || event.key === "_") onChange(value - 1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <span
      className={`inline-flex h-6 items-center overflow-hidden rounded-md border text-xs tabular-nums ${
        own ? "border-accent/70 bg-accent/15 text-accent" : "border-border text-foreground"
      } ${value === 0 ? "opacity-60" : ""}`}
    >
      <button
        onClick={() => onChange(value + 1)}
        onKeyDown={onKey}
        title={title}
        aria-label={`${difficulty.name} unlock tickets: ${value}. Add one`}
        className="flex h-full w-11 items-center justify-center gap-1 px-1 hover:bg-surface-2"
      >
        <span className="font-medium">{difficulty.name}</span>
        <span>{value}</span>
      </button>
      <button
        onClick={() => onChange(value - 1)}
        disabled={value === 0}
        aria-label={`One fewer ${difficulty.name} unlock ticket`}
        className="flex h-full w-4 items-center justify-center border-l border-current/20 hover:bg-surface-2 disabled:opacity-40"
      >
        <Minus size={10} />
      </button>
    </span>
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
