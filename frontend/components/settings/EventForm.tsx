"use client";

import { FormEvent, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import NumberInput from "@/components/NumberInput";
import { api, DifficultyDraft, EventTemplate } from "@/lib/api";

const OTHER_BASE = "__other__";

/** The Wednesday reset at least four weeks out: how long Extreme events usually run. */
function defaultEventEnd() {
  const date = new Date();
  date.setDate(date.getDate() + 28);
  date.setDate(date.getDate() + ((3 - date.getDay() + 7) % 7));
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Add an Extreme (or other limited-time) raid: pick the raid, check the defaults, done. */
export default function EventForm({ onCreate, onError }: { onCreate: (data: object) => Promise<void>; onError: (error: string) => void }) {
  const [template, setTemplate] = useState<EventTemplate | null>(null);
  const [base, setBase] = useState("");
  const [customName, setCustomName] = useState("");
  const [endsOn, setEndsOn] = useState(defaultEventEnd);
  const [rows, setRows] = useState<DifficultyDraft[]>([]);

  useEffect(() => {
    api<EventTemplate>("/event-raids/template")
      .then((data) => {
        setTemplate(data);
        setBase(data.bases[0] ?? OTHER_BASE);
        setRows(data.difficulties);
      })
      .catch((e) => onError(describeError(e)));
  }, [onError]);

  const name = base === OTHER_BASE ? customName.trim() : `${base} Extreme`;

  function updateRow(index: number, changes: Partial<DifficultyDraft>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({ name, ends_on: endsOn, difficulties: rows.filter((row) => row.name.trim()) });
    if (template) setRows(template.difficulties);
    setCustomName("");
    setEndsOn(defaultEventEnd());
  }

  if (!template) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border bg-surface p-4 text-sm">
      <h2 className="font-semibold">Add an event raid</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Which raid is getting an Extreme mode?
          <select value={base} onChange={(e) => setBase(e.target.value)} className="text-sm text-foreground">
            {template.bases.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
            <option value={OTHER_BASE}>Something else…</option>
          </select>
        </label>
        {base === OTHER_BASE && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Event name
            <input required value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Thaemine Extreme" className="text-sm text-foreground" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Ends on (it disappears that day)
          <input required type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="text-sm text-foreground" />
        </label>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">
          Difficulties, prefilled from past Extreme raids. Adjust them to match the patch notes.
        </p>
        <div className="space-y-1.5">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} aria-label="Difficulty" className="w-32" />
              <input
                type="number"
                step="any"
                value={row.min_item_level}
                onChange={(e) => updateRow(index, { min_item_level: Number(e.target.value) || 0 })}
                aria-label={`${row.name} item level`}
                className="w-24"
              />
              <NumberInput
                placeholder="Gold"
                value={row.gold === null ? "" : String(row.gold)}
                onChange={(digits) => updateRow(index, { gold: digits === "" ? null : Number(digits) })}
                aria-label={`${row.name} gold`}
                className="w-28"
              />
              <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== index))} className="rounded px-1.5 text-xs text-danger hover:bg-danger/10">
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows([...rows, { name: "", min_item_level: 0, gold: null }])}
            className="text-xs text-muted underline"
          >
            Add difficulty
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!name || rows.length === 0} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-40">
          Add {name || "event"}
        </button>
        <span className="text-xs text-muted">One clear per roster per week. Pays gold to any character, on top of the 3-raid limit.</span>
      </div>
    </form>
  );
}
