"use client";

import { Plus, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import NumberInput from "@/components/NumberInput";
import { send } from "@/lib/api";
import { GOLD_SOURCES } from "@/lib/goldSources";
import { usePreference } from "@/lib/usePreference";

/**
 * Log gold from the tracker without leaving it: pick a source, type the
 * amount, Enter. Remembers the last source. Dates and notes live on the Gold page.
 */
export default function QuickGold({ onLogged, onError }: { onLogged: () => void; onError: (error: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = usePreference<string>("quick-gold-source", GOLD_SOURCES[0], GOLD_SOURCES);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number(amount) || saving) return;
    setSaving(true);
    try {
      await send("POST", "/gold-entries", { source, amount: Number(amount) });
      setAmount("");
      setOpen(false);
      onLogged();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={boxRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-accent/60 hover:text-foreground"
      >
        <Plus size={12} /> Log
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-32px)] rounded-md border border-border bg-surface p-3 text-sm text-foreground shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Log gold</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-0.5 text-muted hover:bg-surface-2">
              <X size={14} />
            </button>
          </div>
          <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Source">
            {GOLD_SOURCES.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={source === name}
                onClick={() => setSource(name)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  source === name ? "border-accent bg-accent/15 font-medium" : "border-border text-muted hover:text-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <NumberInput
              autoFocus
              required
              placeholder="Amount"
              value={amount}
              onChange={setAmount}
              aria-label="Gold amount"
              className="min-w-0 flex-1"
            />
            <button type="submit" disabled={saving} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-60">
              Add
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">For a past day, another source or a note, use the Gold page.</p>
        </form>
      )}
    </div>
  );
}
