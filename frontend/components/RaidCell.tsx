"use client";

import { useState } from "react";

import { Character, Run, Task } from "@/lib/api";
import { bestDifficulty, difficultyOf, formatItemLevel, formatShortGold, shortDifficulty } from "@/lib/raids";

/**
 * A raid cell: a checkbox plus the difficulty run, which can be changed right
 * here. Raids the character doesn't usually run show faded, so an extra clear
 * can still be ticked.
 */
export default function RaidCell({
  task,
  character,
  isAssigned,
  run,
  clearedBy,
  onToggle,
  onDifficulty,
}: {
  task: Task;
  character: Character;
  isAssigned: boolean;
  run: Run | undefined;
  clearedBy: string | undefined;
  onToggle: (done: boolean, difficultyId: number | undefined) => void;
  onDifficulty: (difficultyId: number, done: boolean) => void;
}) {
  // Difficulty picked for an extra (unassigned) run before it's checked.
  const [choice, setChoice] = useState<number | null>(null);

  if (clearedBy) {
    return (
      <div className="flex h-12 items-center justify-center text-[11px] text-muted" title={`${task.name} is one clear per roster per week`}>
        ✓ {clearedBy}
      </div>
    );
  }

  const done = Boolean(run);
  const usual = isAssigned ? difficultyOf(character, task) : undefined;
  const shownId = run?.difficulty_id ?? choice ?? usual?.id ?? bestDifficulty(task, character.item_level)?.id;
  const shown = task.difficulties.find((d) => d.id === shownId);
  const underLevel = shown ? shown.min_item_level > character.item_level : false;
  const extra = !isAssigned;

  return (
    <div
      className={`${done ? "bg-done/15" : ""} ${extra && !done ? "opacity-35 hover:opacity-100 focus-within:opacity-100" : ""}`}
      title={extra ? `Not one of ${character.name}'s usual raids. Check it if you ran it this week.` : undefined}
    >
      <label className="flex h-7 cursor-pointer items-end justify-center">
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(!done, shownId)}
          aria-label={`${task.name} for ${character.name}`}
          className="h-4 w-4 cursor-pointer"
        />
      </label>
      <select
        value={shownId ?? ""}
        onChange={(e) => {
          const id = Number(e.target.value);
          if (extra) setChoice(id);
          onDifficulty(id, done);
        }}
        aria-label={`${task.name} difficulty for ${character.name}`}
        title={underLevel && shown ? `${shown.name} needs item level ${formatItemLevel(shown.min_item_level)}` : undefined}
        className={`mx-auto mb-1 block cursor-pointer appearance-none rounded border-0 bg-transparent px-1 py-0.5 text-center text-[11px] hover:bg-surface-2 ${
          underLevel ? "text-danger" : "text-muted"
        }`}
      >
        {task.difficulties.map((d) => (
          <option key={d.id} value={d.id}>
            {shortDifficulty(d.name)} · {formatShortGold(d.gold)}
            {d.min_item_level > character.item_level ? " ⚠" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
