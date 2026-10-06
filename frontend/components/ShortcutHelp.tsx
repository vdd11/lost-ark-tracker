"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

import { GO_TO } from "@/lib/shortcuts";
import GameIcon from "@/components/GameIcon";

const GROUPS: { title: string; keys: [string[], string][] }[] = [
  {
    title: "Tracker",
    keys: [
      [["Tab"], "Move into a card (each card is one stop)"],
      [["←", "↑", "→", "↓"], "Move between cells"],
      [["Home", "End"], "First / last cell in the row"],
      [["Space", "Enter"], "Tick or untick the cell (Ebony Cube: add a run)"],
      [["+", "−"], "Ebony Cube runs up / down"],
      [["a"], "Mark everything left for that character done"],
    ],
  },
  {
    title: "Anywhere",
    keys: [
      ...Object.entries(GO_TO).map(([key, { label }]) => [["g", key], `Go to ${label}`] as [string[], string]),
      [["?"], "Show this list"],
      [["Esc"], "Close it"],
    ],
  },
];

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="min-w-6 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-center font-mono text-xs">{children}</kbd>
  );
}

/** The keyboard cheat sheet (press ?). Shortcuts never fire while you type in a field. */
export default function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="shortcut-help-title" className="flex items-center gap-2 font-semibold">
            <GameIcon name="shortcuts" size={24} alt="" /> Keyboard shortcuts
          </h2>
          <button ref={closeButton} onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>
        {GROUPS.map((group) => (
          <section key={group.title} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{group.title}</h3>
            <ul className="space-y-1.5 text-sm">
              {group.keys.map(([keys, description]) => (
                <li key={description} className="flex items-center justify-between gap-4">
                  <span>{description}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && keys[0] === "g" && <span className="text-xs text-muted">then</span>}
                        <Key>{key}</Key>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="mt-4 text-xs text-muted">Shortcuts are off while you&apos;re typing in a box.</p>
      </div>
    </div>
  );
}
