import { Check } from "lucide-react";

/**
 * A checkbox for a daily with more than one run today (Chaos Dungeon with
 * Inanna's): it fills a part per run, and is done when full. The same size
 * as the plain checkbox, so switching between them moves nothing.
 */
export default function RunsCheckbox({
  runs,
  needed,
  label,
  onClick,
}: {
  runs: number;
  needed: number;
  label: string;
  onClick: () => void;
}) {
  const done = runs >= needed;
  const fill = `${Math.min(100, (runs / needed) * 100)}%`;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done ? true : runs > 0 ? "mixed" : false}
      aria-label={`${label} (${Math.min(runs, needed)} of ${needed} runs)`}
      title={`Inanna's blessing: ${needed} runs today. Click once per run.`}
      onClick={onClick}
      className="relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded border border-muted/70 bg-surface"
    >
      <span className="absolute inset-x-0 bottom-0 bg-done transition-[height]" style={{ height: fill }} />
      {done && <Check size={14} strokeWidth={3} className="relative text-white" />}
    </button>
  );
}
