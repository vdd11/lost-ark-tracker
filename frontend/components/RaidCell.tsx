"use client";

import { Check, ChevronDown, Gift } from "lucide-react";
import { useState } from "react";

import { Character, formatGold, Run, Task } from "@/lib/api";
import { bestDifficulty, difficultyOf, formatItemLevel, formatShortGold } from "@/lib/raids";

/**
 * A raid cell: a checkbox, the difficulty (a dropdown you can change right
 * here), and once cleared, a "Bonus box" button for the View More chests.
 * Raids the character doesn't usually run show faded, so an extra clear can
 * still be ticked.
 */
export default function RaidCell({
  task,
  character,
  isAssigned,
  run,
  clearedBy,
  onToggle,
  onDifficulty,
  onBonus,
}: {
  task: Task;
  character: Character;
  isAssigned: boolean;
  run: Run | undefined;
  clearedBy: string | undefined;
  onToggle: (done: boolean, difficultyId: number | undefined) => void;
  onDifficulty: (difficultyId: number, done: boolean) => void;
  onBonus: (bought: boolean) => void;
}) {
  // Difficulty picked for an extra (unassigned) run before it's checked.
  const [choice, setChoice] = useState<number | null>(null);

  if (clearedBy) {
    return (
      <div className="flex h-full min-h-14 items-center justify-center gap-1 text-xs text-muted" title={`${task.name} is one clear per roster per week`}>
        <Check size={14} /> {clearedBy}
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
      className={`flex flex-col items-center gap-1.5 px-1 py-2 ${done ? "bg-done/15" : ""} ${
        extra && !done ? "opacity-40 hover:opacity-100 focus-within:opacity-100" : ""
      }`}
      title={extra ? `Not one of ${character.name}'s usual raids. Check it if you ran it this week.` : undefined}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(!done, shownId)}
        aria-label={`${task.name} cleared by ${character.name}`}
        className="h-5 w-5 cursor-pointer"
      />

      <label className="relative" title={underLevel && shown ? `${shown.name} needs item level ${formatItemLevel(shown.min_item_level)}` : "Change difficulty"}>
        <select
          value={shownId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (extra) setChoice(id);
            onDifficulty(id, done);
          }}
          aria-label={`${task.name} difficulty for ${character.name}`}
          className={`w-36 cursor-pointer appearance-none truncate rounded-md border py-0.5 pl-2 pr-6 text-xs ${
            underLevel ? "border-danger/50 text-danger" : "border-border text-foreground"
          } bg-surface hover:bg-surface-2`}
        >
          {task.difficulties.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {formatShortGold(d.gold)}
              {d.min_item_level > character.item_level ? ` (needs ${formatItemLevel(d.min_item_level)})` : ""}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" />
      </label>

      {done && (
        <button
          onClick={() => onBonus(!run!.bought_bonus)}
          aria-pressed={run!.bought_bonus}
          aria-label={`Bought the ${task.name} bonus box on ${character.name}`}
          title={
            shown?.bonus_cost == null
              ? "Bonus box cost unknown for this difficulty: set it on the Raids page"
              : `Bought the bonus ("View More") boxes for every gate: ${formatGold(shown.bonus_cost)} gold`
          }
          className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] ${
            run!.bought_bonus
              ? "bg-accent/20 font-medium text-accent"
              : "border border-dashed border-border text-muted hover:border-accent/60 hover:text-foreground"
          }`}
        >
          <Gift size={12} />
          {run!.bought_bonus ? `Bought −${formatShortGold(run!.bonus_spent || shown?.bonus_cost || null)}` : "Bonus box"}
        </button>
      )}
    </div>
  );
}
