"use client";

import { Eye, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { formatUnitPrice, parsePrice, Price, priceAge } from "@/lib/prices";

export type PriceChange = { price?: number | null; per?: number; hidden?: boolean; name?: string };

/** One editable row of the Prices table. Saves on Enter or when the field loses focus. */
export default function PriceRow({
  item,
  now,
  onChange,
  onRemove,
}: {
  item: Price;
  now: Date;
  onChange: (change: PriceChange) => void;
  onRemove: () => void;
}) {
  const [price, setPrice] = useState<string | null>(null);
  const [per, setPer] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const age = priceAge(item.updated_at, now);

  function commitPrice(text: string) {
    setPrice(null);
    const value = parsePrice(text);
    if (text.trim() !== "" && value === null) return; // not a number: keep the old price
    if (value !== item.price) onChange({ price: value });
  }

  function commitPer(text: string) {
    setPer(null);
    const value = Math.floor(Number(text));
    if (Number.isFinite(value) && value >= 1 && value !== item.per) onChange({ per: value });
  }

  function commitName(text: string) {
    setName(null);
    if (text.trim() && text.trim() !== item.name) onChange({ name: text.trim() });
  }

  const enter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  return (
    <tr className={`border-b border-border last:border-0 ${item.hidden ? "text-muted" : ""}`}>
      <td className="py-1.5 pr-2">
        {item.builtin ? (
          item.name
        ) : (
          <input
            value={name ?? item.name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => commitName(e.target.value)}
            onKeyDown={enter}
            aria-label="Item name"
            className="w-full min-w-40"
          />
        )}
      </td>
      <td className="py-1.5 pr-2">
        <input
          inputMode="decimal"
          autoComplete="off"
          value={price ?? (item.price == null ? "" : String(item.price))}
          placeholder="?"
          onChange={(e) => setPrice(e.target.value)}
          onBlur={(e) => commitPrice(e.target.value)}
          onKeyDown={enter}
          aria-label={`Price of ${item.name}`}
          className="w-28 text-right tabular-nums"
        />
      </td>
      <td className="py-1.5 pr-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          value={per ?? String(item.per)}
          onChange={(e) => setPer(e.target.value)}
          onBlur={(e) => commitPer(e.target.value)}
          onKeyDown={enter}
          aria-label={`Units the price of ${item.name} is for`}
          className="w-20 text-right tabular-nums"
        />
      </td>
      <td className="py-1.5 pr-2 text-right tabular-nums">{item.unit_price == null ? "–" : formatUnitPrice(item.unit_price)}</td>
      <td className="py-1.5 pr-2 text-xs">
        {age ? <span className={age.stale ? "text-accent" : "text-muted"} title={age.stale ? "May be out of date" : undefined}>{age.text}</span> : <span className="text-muted">never</span>}
      </td>
      <td className="py-1.5 text-right whitespace-nowrap">
        <button
          onClick={() => onChange({ hidden: !item.hidden })}
          aria-label={item.hidden ? `Show ${item.name}` : `Hide ${item.name}`}
          title={item.hidden ? "Show" : "Hide"}
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground"
        >
          {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={onRemove}
          aria-label={item.builtin ? `Reset ${item.name}` : `Delete ${item.name}`}
          title={item.builtin ? "Reset to built-in (no price)" : "Delete"}
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger"
        >
          {item.builtin ? <RotateCcw size={14} /> : <Trash2 size={14} />}
        </button>
      </td>
    </tr>
  );
}
