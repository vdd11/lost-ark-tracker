"use client";

import { Flame, Minus, Plus } from "lucide-react";
import { KeyboardEvent, useRef, useState } from "react";

import { RestState, Task } from "@/lib/api";

/**
 * A character's rest bonus for a daily: a bar with -/+ (one day's worth of
 * rest per step) and a "Rested" badge when today's run gets the bonus.
 * Click the number to type the exact value the game shows.
 */
export default function RestGauge({
  task,
  state,
  characterName,
  onSet,
}: {
  task: Task;
  state: RestState;
  characterName: string;
  onSet: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Enter/Escape close the input, which also fires blur; handle only the first.
  const closed = useRef(false);
  const step = task.rest_gain || 10;
  const fill = Math.min(100, (state.value / task.rest_max) * 100);
  const label = `${task.name} rest bonus for ${characterName}`;
  const set = (value: number) => onSet(Math.max(0, Math.min(task.rest_max, value)));

  function open() {
    closed.current = false;
    setDraft(String(state.value));
  }

  function commit() {
    if (draft === null || closed.current) return;
    closed.current = true;
    const value = Math.round(Number(draft));
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(value) && value !== state.value) set(value);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") {
      closed.current = true;
      setDraft(null);
    }
  }

  const stepButton =
    "flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30";

  return (
    <div className="flex flex-col items-center gap-1 pb-2 text-xs">
      <div className="flex items-center gap-1.5">
        <button onClick={() => set(state.value - step)} disabled={state.value <= 0} aria-label={`Less ${label}`} title={`−${step} rest`} className={stepButton}>
          <Minus size={12} />
        </button>
        {draft === null ? (
          <button
            onClick={open}
            title={`Rest bonus ${state.value}/${task.rest_max}. A run uses ${task.rest_cost}; skipping a day adds ${task.rest_gain}. Click to type the value from the game.`}
            aria-label={`${label}: ${state.value} of ${task.rest_max}. Click to edit`}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-surface-2"
          >
            <span className="h-2 w-14 overflow-hidden rounded-full bg-surface-2">
              <span
                className={`block h-full rounded-full ${state.rested_run_available ? "bg-accent" : "bg-muted/60"}`}
                style={{ width: `${fill}%` }}
              />
            </span>
            <span className="w-7 text-left tabular-nums">{state.value}</span>
          </button>
        ) : (
          <input
            autoFocus
            type="number"
            min={0}
            max={task.rest_max}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
            aria-label={label}
            className="w-20 px-1.5 py-0.5 text-xs"
          />
        )}
        <button onClick={() => set(state.value + step)} disabled={state.value >= task.rest_max} aria-label={`More ${label}`} title={`+${step} rest`} className={stepButton}>
          <Plus size={12} />
        </button>
      </div>
      {state.rested_run_available && (
        <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent" title={`Today's run uses ${task.rest_cost} rest for bonus rewards`}>
          <Flame size={12} /> Rested
        </span>
      )}
    </div>
  );
}
