import { Minus, Plus } from "lucide-react";

/**
 * Embers a daily dropped today, under its checkbox: fate embers, and blessed
 * embers (on a second line) while Azena's blessing is on. Always the same
 * size once logging is on, and greyed until the daily is ticked, so ticking
 * moves nothing.
 */
export default function EmberCounts({
  who,
  task,
  fate,
  blessed,
  showBlessed,
  enabled,
  onChange,
}: {
  who: string;
  task: string;
  fate: number;
  blessed: number;
  showBlessed: boolean;
  /** Only once there's a run to log them on. */
  enabled: boolean;
  onChange: (changes: { fate_embers?: number; blessed_embers?: number }) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Embers from ${task} on ${who}`}
      className={`flex flex-col items-center gap-1 text-xs ${enabled ? "" : "opacity-40"}`}
      title={enabled ? "Embers this run dropped" : "Tick it first, then log its embers"}
    >
      <Counter label="Fate" value={fate} enabled={enabled} onChange={(n) => onChange({ fate_embers: n })} />
      {showBlessed && <Counter label="Blessed" value={blessed} enabled={enabled} onChange={(n) => onChange({ blessed_embers: n })} />}
    </div>
  );
}

function Counter({ label, value, enabled, onChange }: { label: string; value: number; enabled: boolean; onChange: (n: number) => void }) {
  const button = "flex h-5 w-5 items-center justify-center rounded border border-border text-muted hover:bg-surface-2 disabled:opacity-30";
  return (
    <span className="flex items-center gap-1">
      <span className="w-12 text-right text-muted">{label}</span>
      <button onClick={() => onChange(value - 1)} disabled={!enabled || value === 0} aria-label={`One fewer ${label.toLowerCase()} ember`} className={button}>
        <Minus size={10} />
      </button>
      <span className="w-4 text-center tabular-nums" aria-label={`${value} ${label.toLowerCase()} embers`}>
        {value}
      </span>
      <button onClick={() => onChange(value + 1)} disabled={!enabled} aria-label={`One more ${label.toLowerCase()} ember`} className={button}>
        <Plus size={10} />
      </button>
    </span>
  );
}
