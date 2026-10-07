"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import DifficultySelect from "@/components/DifficultySelect";
import { Character, formatGold, Run, Task } from "@/lib/api";
import { bestDifficulty, clearedGates, difficultyOf, formatShortGold, FREE_BONUS_RAIDS_PER_WEEK, gateGold, isWholeClear } from "@/lib/raids";
import GameIcon from "@/components/GameIcon";

/**
 * A raid cell: a checkbox, its gates (G1, G2: tick them one at a time, or the
 * checkbox for all), the difficulty (a dropdown you can change right here),
 * and once cleared, a "Bonus box" button for the View More chests.
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
  onGate,
  onDifficulty,
  onBonus,
  compact = false,
}: {
  task: Task;
  character: Character;
  isAssigned: boolean;
  run: Run | undefined;
  clearedBy: string | undefined;
  onToggle: (done: boolean, difficultyId: number | undefined) => void;
  /** Clear one gate at a difficulty, or un-clear it (null). */
  onGate: (gate: number, difficultyId: number | null) => void;
  onDifficulty: (difficultyId: number, done: boolean) => void;
  onBonus: (bought: boolean) => void;
  /** Show a usual raid's difficulty as a plain label; change it in "Edit who does what". */
  compact?: boolean;
}) {
  // Difficulty picked for an extra (unassigned) run before it's checked.
  const [choice, setChoice] = useState<number | null>(null);
  const checkbox = useRef<HTMLInputElement>(null);
  const gates = clearedGates(task, run);
  const gateCount = task.gate_count ?? 0;
  const partial = Boolean(run) && !isWholeClear(task, run);
  useEffect(() => {
    if (checkbox.current) checkbox.current.indeterminate = partial;
  }, [partial]);

  if (clearedBy) {
    return (
      <div className="flex h-full min-h-14 items-center justify-center gap-1 text-xs text-muted" title={`${task.name} is one clear per roster per week`}>
        <Check size={14} /> {clearedBy}
      </div>
    );
  }

  const done = Boolean(run) && !partial;
  const usual = isAssigned ? difficultyOf(character, task) : undefined;
  const shownId = run?.difficulty_id ?? choice ?? usual?.id ?? bestDifficulty(task, character.item_level)?.id;
  const shown = task.difficulties.find((d) => d.id === shownId);
  const extra = !isAssigned;
  // Non-earners get no raid gold (event raids that pay everyone aside), so their cells show none.
  const showGold = character.is_gold_earner || task.gold_for_everyone;
  const freeBonus = !character.is_gold_earner && !!run?.bought_bonus && run.bonus_spent === 0;

  return (
    <div
      className={`flex flex-col items-center gap-1.5 px-1 py-2 ${done ? "bg-done/15" : partial ? "bg-done/5" : ""} ${
        extra && !run ? "opacity-40 hover:opacity-100 focus-within:opacity-100" : ""
      }`}
      title={extra ? `Not one of ${character.name}'s usual raids. Check it if you ran it this week.` : undefined}
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={checkbox}
          type="checkbox"
          checked={done}
          onChange={() => onToggle(!done, shownId)}
          aria-label={`${task.name} cleared by ${character.name}${partial ? ` (${Object.keys(gates).length} of ${gateCount} gates)` : ""}`}
          className="h-5 w-5 cursor-pointer"
        />
        {/* One toggle per gate, always there for raids with gates, so clearing one moves nothing. */}
        {gateCount > 0 && (
          <span className="flex items-center gap-1" role="group" aria-label={`${task.name} gates for ${character.name}`}>
            {Array.from({ length: gateCount }, (_, i) => i + 1).map((gate) => {
              const cleared = gate in gates;
              const atId = cleared ? gates[gate] : shownId;
              const gold = gateGold(task, atId, gate);
              const at = task.difficulties.find((d) => d.id === atId)?.name;
              return (
                <button
                  key={gate}
                  type="button"
                  onClick={() => onGate(gate, cleared ? null : (shownId ?? null))}
                  aria-pressed={cleared}
                  aria-label={`${task.name} gate ${gate} cleared by ${character.name}`}
                  title={`Gate ${gate}${at ? ` (${at})` : ""}${showGold ? `: ${gold === null ? "gold per gate unknown" : `${formatGold(gold)} gold`}` : ""}`}
                  className={`h-5 rounded px-1 text-[10px] font-medium leading-none ${
                    // Both states have a border, so a gate changing state keeps its width.
                    cleared ? "border border-transparent bg-done/30 text-foreground" : "border border-dashed border-border text-muted hover:border-done/60 hover:text-foreground"
                  }`}
                >
                  G{gate}
                </button>
              );
            })}
            <span className="w-6 text-[10px] tabular-nums text-muted">{partial ? `${Object.keys(gates).length}/${gateCount}` : ""}</span>
          </span>
        )}
      </div>

      {compact && !extra && shown ? (
        <span
          className={`flex h-[26px] items-center text-xs ${shown.min_item_level > character.item_level ? "text-danger" : "text-muted"}`}
          title="Change the difficulty in Edit who does what, or turn the pickers back on in Customize"
        >
          {shown.name}
          {showGold ? ` · ${formatShortGold(shown.gold)}` : ""}
        </span>
      ) : (
      <DifficultySelect
        task={task}
        character={character}
        value={shownId ?? null}
        label={`${task.name} difficulty for ${character.name}`}
        showGold={showGold}
        onChange={(id) => {
          if (id === null) return;
          if (extra) setChoice(id);
          onDifficulty(id, done);
        }}
      />
      )}

      {/* The bonus box slot is always there, so checking a raid never moves the checkbox. */}
      <div className="flex h-5 items-center">
        {run && (
          <button
            onClick={() => onBonus(!run!.bought_bonus)}
            aria-pressed={run!.bought_bonus}
            aria-label={`Bought the ${task.name} bonus box on ${character.name}`}
            title={
              !character.is_gold_earner
                ? `Non-earners' bonus boxes are free for ${FREE_BONUS_RAIDS_PER_WEEK} raids a week`
                : shown?.bonus_cost == null
                ? "Bonus box cost not known yet for this difficulty"
                : partial
                ? `Bought the bonus ("View More") boxes for the gates cleared`
                : `Bought the bonus ("View More") boxes for every gate: ${formatGold(shown.bonus_cost)} gold`
            }
            className={`flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs ${
              run!.bought_bonus
                ? "bg-accent/20 font-medium text-accent"
                : "border border-dashed border-border text-muted hover:border-accent/60 hover:text-foreground"
            }`}
          >
            <GameIcon name="bonus-box" size={12} inline alt="" />
            {freeBonus ? "Free" : run!.bought_bonus ? `Bought −${formatShortGold(run!.bonus_spent || shown?.bonus_cost || null)}` : "Bonus box"}
          </button>
        )}
      </div>
    </div>
  );
}
