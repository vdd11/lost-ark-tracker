"use client";

import { Pencil } from "lucide-react";
import { KeyboardEvent, useRef, useState } from "react";

import NumberInput from "@/components/NumberInput";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { Character, formatGold } from "@/lib/api";

/** Whether a character runs a raid that pays character-bound gold. */
function earnsCharacterBound(character: Character, data: TrackerData) {
  return data.tasks.some((task) => {
    if (!character.task_ids.includes(task.id)) return false;
    const id = character.difficulty_ids[String(task.id)];
    return task.difficulties.some((d) => d.id === id && d.bound_kind === "character" && d.bound_percent > 0);
  });
}

/**
 * "Bound: 12,300" under a character's name: their character-bound gold,
 * kept up to date from what they earn and spend. Click to enter what the game
 * shows. Shown once set, or for characters whose raids pay it.
 */
export default function BoundGoldNote({ character, data }: { character: Character; data: TrackerData }) {
  const value = data.boundGold[String(character.id)] ?? null;
  const [draft, setDraft] = useState<string | null>(null);
  const closed = useRef(false);
  if (value === null && !earnsCharacterBound(character, data)) return null;

  function commit() {
    if (draft === null || closed.current) return;
    closed.current = true;
    const next = Number(draft);
    setDraft(null);
    if (draft !== "" && Number.isFinite(next) && next !== value) data.actions.setBoundGold(character, next);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") {
      closed.current = true;
      setDraft(null);
    }
  }

  return (
    <div className="mt-0.5 flex h-5 items-center gap-1 text-[11px] text-muted">
      Bound:
      {draft !== null ? (
        <NumberInput
          autoFocus
          value={draft}
          onChange={setDraft}
          onBlur={commit}
          onKeyDown={handleKey}
          aria-label={`${character.name}'s character-bound gold`}
          className="h-5 w-24 px-1 py-0 text-[11px] tabular-nums"
        />
      ) : (
        <button
          onClick={() => {
            closed.current = false;
            setDraft(value === null ? "" : String(value));
          }}
          title="Character-bound gold now, kept up to date from clears and spending. Click to enter what the game shows."
          aria-label={`Set ${character.name}'s character-bound gold`}
          className="flex items-center gap-1 rounded px-0.5 tabular-nums hover:text-foreground"
        >
          {value === null ? "set" : formatGold(value)}
          <Pencil size={10} />
        </button>
      )}
    </div>
  );
}
