"use client";

import { TrendingUp, X } from "lucide-react";
import { FormEvent, useState } from "react";

import { Character } from "@/lib/api";
import { formatItemLevel } from "@/lib/raids";

/** Update every character's item level at once, e.g. after a honing session. */
export default function ItemLevelPanel({
  characters,
  onSave,
  onClose,
}: {
  characters: Character[];
  onSave: (changes: { character: Character; itemLevel: number }[]) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<number, string>>(() =>
    Object.fromEntries(characters.map((c) => [c.id, c.item_level ? String(c.item_level) : ""])),
  );
  const [saving, setSaving] = useState(false);

  const changes = characters
    .map((character) => ({ character, itemLevel: Number(draft[character.id]) }))
    .filter(
      ({ character, itemLevel }) =>
        draft[character.id]?.trim() !== "" && Number.isFinite(itemLevel) && itemLevel >= 0 && itemLevel !== character.item_level,
    );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (changes.length === 0) return onClose();
    setSaving(true);
    await onSave(changes);
    setSaving(false);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-accent/40 bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <TrendingUp size={18} className="text-accent" /> Update item levels
          </h2>
          <p className="text-xs text-muted">
            Usual raids, Cube unlocks and Hourglass move to the tier the new item level allows. Anything already run
            this week keeps the difficulty it was run at.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((character) => {
          const changed = changes.some((c) => c.character.id === character.id);
          return (
            <label key={character.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">{character.name}</span>{" "}
                <span className="text-xs text-muted">{character.class_name}</span>
              </span>
              <span className="flex items-center gap-2">
                {changed && <span className="text-xs text-muted line-through">{formatItemLevel(character.item_level)}</span>}
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={draft[character.id] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [character.id]: e.target.value })}
                  aria-label={`${character.name} item level`}
                  className={`w-24 ${changed ? "border-accent" : ""}`}
                />
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {changes.length === 0 ? "Close" : `Save ${changes.length} ${changes.length === 1 ? "change" : "changes"}`}
        </button>
      </div>
    </form>
  );
}
