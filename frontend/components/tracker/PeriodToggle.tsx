import { Period, PERIODS } from "@/lib/periods";

/** A small "Week / 4 wk / All" switch for a widget's header. */
export default function PeriodToggle({ value, onChange, label }: { value: Period; onChange: (p: Period) => void; label: string }) {
  return (
    <div className="flex rounded-md border border-border p-0.5 text-[11px]" role="group" aria-label={label}>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          aria-pressed={value === p.key}
          title={p.label}
          className={`rounded px-1.5 py-0.5 ${value === p.key ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:text-foreground"}`}
        >
          {p.short}
        </button>
      ))}
    </div>
  );
}
