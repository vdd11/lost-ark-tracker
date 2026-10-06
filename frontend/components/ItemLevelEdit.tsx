"use client";

import { Pencil } from "lucide-react";
import { KeyboardEvent, useRef, useState } from "react";

import { formatItemLevel } from "@/lib/raids";

/** A character's item level that turns into an input when clicked. */
export default function ItemLevelEdit({
  value,
  characterName,
  onSave,
  tone = "",
  hint,
}: {
  value: number;
  characterName: string;
  onSave: (value: number) => void;
  /** A text colour for the number, e.g. by the raid tier it reaches. */
  tone?: string;
  /** Added to the tooltip, e.g. "Can enter up to Serca Hard (1730)". */
  hint?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Enter/Escape close the input, which also fires blur; handle only the first.
  const closed = useRef(false);

  function open() {
    closed.current = false;
    setDraft(value > 0 ? String(value) : "");
  }

  function commit() {
    if (draft === null || closed.current) return;
    closed.current = true;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() !== "" && Number.isFinite(next) && next >= 0 && next !== value) onSave(next);
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") {
      closed.current = true;
      setDraft(null);
    }
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        type="number"
        step="any"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        aria-label={`${characterName} item level`}
        className="w-20 px-1 py-0 text-xs"
      />
    );
  }

  return (
    <button
      onClick={open}
      title={hint ? `${hint}. Click to update item level` : "Click to update item level"}
      aria-label={`${characterName} item level ${value || "not set"}. Click to edit`}
      className={`inline-flex items-center gap-1 rounded px-0.5 font-medium tabular-nums hover:bg-surface-2 hover:text-foreground ${tone}`}
    >
      {value > 0 ? formatItemLevel(value) : "set ilvl"}
      <Pencil size={10} className="opacity-60" />
    </button>
  );
}
