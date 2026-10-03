import { X } from "lucide-react";

import { Task } from "@/lib/api";
import { CHARACTER_BOUND_KEY, SECTION_KEYS, sectionOf, viewKey } from "@/lib/trackerView";

/** Choose what the tracker shows. Saved in this browser only. */
export default function CustomizePanel({
  tasks,
  hidden,
  onChange,
  onReset,
  onClose,
}: {
  tasks: Task[];
  hidden: Set<string>;
  onChange: (key: string, visible: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const groups = [
    {
      title: "Sections",
      items: [
        { key: SECTION_KEYS.gold, label: "Gold summary" },
        { key: SECTION_KEYS.today, label: "Today (dailies)" },
        { key: SECTION_KEYS.anytime, label: "Any time (Ebony Cube)" },
      ],
    },
    {
      title: "This week",
      items: [
        ...tasks.filter((t) => sectionOf(t) === "week").map((t) => ({ key: viewKey(t), label: t.name })),
        { key: CHARACTER_BOUND_KEY, label: "Character-bound gold" },
      ],
    },
    { title: "Today", items: tasks.filter((t) => sectionOf(t) === "today").map((t) => ({ key: viewKey(t), label: t.name })) },
    { title: "Any time", items: tasks.filter((t) => sectionOf(t) === "anytime").map((t) => ({ key: viewKey(t), label: t.name })) },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="mb-4 rounded-lg border border-accent/40 bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Customize the tracker</h2>
          <p className="text-xs text-muted">Show only what you care about. This is saved in this browser.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2">
            Reset
          </button>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{group.title}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!hidden.has(item.key)}
                      onChange={(e) => onChange(item.key, e.target.checked)}
                      className="h-4 w-4"
                    />
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
