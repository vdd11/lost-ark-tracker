"use client";

import { KeyboardEvent, useRef, useState } from "react";

import { RestState, Task } from "@/lib/api";

/** A small rest bar under a tracker checkbox. Click the number to correct it. */
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
  const fill = Math.min(100, (state.value / task.rest_max) * 100);
  const label = `${task.name} rest bonus for ${characterName}`;

  function open() {
    closed.current = false;
    setDraft(String(state.value));
  }

  function commit() {
    if (draft === null || closed.current) return;
    closed.current = true;
    const value = Math.round(Number(draft));
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(value) && value !== state.value) {
      onSet(Math.max(0, Math.min(task.rest_max, value)));
    }
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") {
      closed.current = true;
      setDraft(null);
    }
  }

  return (
    <div
      className="flex items-center justify-center gap-1.5 pb-1.5 text-[11px] leading-none"
      title={
        state.rested_run_available
          ? `Rested run available: a run now spends ${task.rest_cost} rest for bonus rewards`
          : `Rest bonus: ${state.value}/${task.rest_max} (+${task.rest_gain} per skipped day)`
      }
    >
      <div className="h-1 w-10 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${state.rested_run_available ? "bg-accent" : "bg-muted/60"}`}
          style={{ width: `${fill}%` }}
        />
      </div>
      {draft === null ? (
        <button
          onClick={open}
          aria-label={`${label}: ${state.value}. Click to edit`}
          className={`min-w-6 rounded px-0.5 tabular-nums hover:bg-surface-2 ${
            state.rested_run_available ? "font-semibold text-accent" : "text-muted"
          }`}
        >
          {state.value}
        </button>
      ) : (
        <input
          autoFocus
          type="number"
          min={0}
          max={task.rest_max}
          step={task.rest_gain || 1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          aria-label={label}
          className="w-14 px-1 py-0.5 text-[11px]"
        />
      )}
    </div>
  );
}
