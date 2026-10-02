"use client";

import { formatGold, Task } from "@/lib/api";
import { bestDifficulty, formatItemLevel, GOLD_RAIDS_PER_WEEK } from "@/lib/raids";

/** task_id -> difficulty_id */
export type RaidSelection = Record<number, number>;

/** Choose which raids (and difficulty) a new character runs. */
export default function RaidPicker({
  raids,
  itemLevel,
  isGoldEarner,
  value,
  onChange,
}: {
  raids: Task[];
  itemLevel: number;
  isGoldEarner: boolean;
  value: RaidSelection;
  onChange: (value: RaidSelection) => void;
}) {
  const selectedCount = Object.keys(value).length;

  function toggle(task: Task) {
    const next = { ...value };
    if (next[task.id]) delete next[task.id];
    else next[task.id] = bestDifficulty(task, itemLevel)?.id ?? 0;
    onChange(next);
  }

  // Best gold first: the hardest eligible difficulty of each raid, top N.
  function pickTopGold() {
    const ranked = raids
      .filter((t) => !t.gold_for_everyone)
      .map((task) => ({ task, difficulty: bestDifficulty(task, itemLevel) }))
      .filter(({ difficulty }) => difficulty && difficulty.min_item_level <= itemLevel)
      .sort((a, b) => (b.difficulty!.gold ?? 0) - (a.difficulty!.gold ?? 0))
      .slice(0, GOLD_RAIDS_PER_WEEK);
    onChange(Object.fromEntries(ranked.map(({ task, difficulty }) => [task.id, difficulty!.id])));
  }

  return (
    <div className="w-full rounded-md border border-border bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          Raids <span className="font-normal text-muted">({selectedCount} selected)</span>
        </span>
        <button type="button" onClick={pickTopGold} className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-2">
          Pick top {GOLD_RAIDS_PER_WEEK} by gold
        </button>
      </div>
      {isGoldEarner && selectedCount > GOLD_RAIDS_PER_WEEK && (
        <p className="mb-2 text-xs text-accent">
          Only {GOLD_RAIDS_PER_WEEK} raids pay gold per character each week (event raids aside).
        </p>
      )}

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {raids.map((task) => {
          const selected = value[task.id];
          const lowest = Math.min(...task.difficulties.map((d) => d.min_item_level));
          const tooLow = task.difficulties.length > 0 && itemLevel < lowest;
          const chosen = task.difficulties.find((d) => d.id === selected);

          return (
            <li key={task.id} className={`flex items-center gap-2 rounded px-2 py-1 ${selected ? "bg-accent/10" : ""}`}>
              <label className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 ${tooLow && !selected ? "text-muted" : ""}`}>
                <input type="checkbox" checked={Boolean(selected)} onChange={() => toggle(task)} />
                <span className="truncate">{task.name}</span>
                {tooLow && <span className="shrink-0 text-xs text-muted">needs {formatItemLevel(lowest)}</span>}
              </label>
              {selected && task.difficulties.length > 0 && (
                <select
                  value={selected}
                  onChange={(e) => onChange({ ...value, [task.id]: Number(e.target.value) })}
                  aria-label={`${task.name} difficulty`}
                  className="py-0.5 text-xs"
                >
                  {task.difficulties.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({formatItemLevel(d.min_item_level)}){d.min_item_level > itemLevel ? " ⚠" : ""}
                    </option>
                  ))}
                </select>
              )}
              {chosen && (
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted">
                  {chosen.gold === null ? "? g" : `${formatGold(chosen.gold)}g`}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
