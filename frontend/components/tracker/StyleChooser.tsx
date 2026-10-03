import { Check, LucideIcon, Swords, Sun, Telescope } from "lucide-react";

import { Style, STYLES } from "@/lib/trackerView";

const ICONS: Record<Style, LucideIcon> = { casual: Swords, regular: Sun, everything: Telescope };

/** Three one-click starting points, from "just my raids" to "track it all". */
export default function StyleChooser({ current, onChoose }: { current: Style | null; onChoose: (style: Style) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {STYLES.map((style) => {
        const Icon = ICONS[style.id];
        const active = current === style.id;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChoose(style.id)}
            aria-pressed={active}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
              active ? "border-accent bg-accent/10" : "border-border bg-surface hover:border-accent/50 hover:bg-surface-2"
            }`}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
              <Icon size={18} />
            </span>
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                {style.label}
                {active && <Check size={14} className="text-accent" />}
              </span>
              <span className="block text-xs text-muted">{style.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
