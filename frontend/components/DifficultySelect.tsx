import { ChevronDown } from "lucide-react";

import { Character, Task } from "@/lib/api";
import { formatItemLevel, formatShortGold } from "@/lib/raids";

/**
 * A compact difficulty dropdown for a raid cell: "Hard · 48k", with the item
 * level needed when the character is under it. With `noneLabel`, an empty
 * choice (e.g. "Doesn't run") comes first.
 */
export default function DifficultySelect({
  task,
  character,
  value,
  onChange,
  noneLabel,
  label,
  highlight = false,
  showGold = true,
}: {
  task: Task;
  character: Character;
  value: number | null;
  onChange: (difficultyId: number | null) => void;
  noneLabel?: string;
  label: string;
  highlight?: boolean;
  /** Off for characters who don't earn raid gold. */
  showGold?: boolean;
}) {
  const shown = task.difficulties.find((d) => d.id === value);
  const underLevel = shown ? shown.min_item_level > character.item_level : false;
  const tone = underLevel
    ? "border-danger/50 text-danger"
    : shown
      ? highlight
        ? "border-accent/60 bg-accent/10 font-medium text-foreground"
        : "border-border text-foreground"
      : "border-dashed border-border text-muted";

  return (
    <label
      className="relative block w-full max-w-36"
      title={underLevel && shown ? `${shown.name} needs item level ${formatItemLevel(shown.min_item_level)}` : "Change difficulty"}
    >
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label={label}
        className={`w-full cursor-pointer appearance-none truncate rounded-md border py-1 pl-2 pr-6 text-xs hover:bg-surface-2 ${
          shown && highlight && !underLevel ? "" : "bg-surface"
        } ${tone}`}
      >
        {noneLabel !== undefined && <option value="">{noneLabel}</option>}
        {task.difficulties.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {task.category === "raid" && showGold ? ` · ${formatShortGold(d.gold)}` : ""}
            {d.min_item_level > character.item_level ? ` (needs ${formatItemLevel(d.min_item_level)})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" />
    </label>
  );
}
