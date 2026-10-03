import { X } from "lucide-react";

import StyleChooser from "@/components/tracker/StyleChooser";
import { Task } from "@/lib/api";
import {
  CHARACTER_BOUND_KEY,
  FINISHED_ROWS_KEY,
  matchingStyle,
  PAGE_KEYS,
  SECTION_KEYS,
  sectionOf,
  STAT_KEYS,
  Style,
  viewKey,
  WIDGET_KEYS,
} from "@/lib/trackerView";

/** Choose what the tracker shows. Saved in this browser only. */
export default function CustomizePanel({
  tasks,
  hidden,
  onChange,
  onStyle,
  onClose,
}: {
  tasks: Task[];
  hidden: Set<string>;
  onChange: (key: string, visible: boolean) => void;
  onStyle: (style: Style) => void;
  onClose: () => void;
}) {
  const taskItems = (section: string) =>
    tasks.filter((t) => sectionOf(t) === section).map((t) => ({ key: viewKey(t), label: t.name }));

  const groups = [
    {
      title: "Top boxes",
      items: [
        { key: STAT_KEYS.raidsLeft, label: "Gold raids left" },
        { key: STAT_KEYS.raidGold, label: "Raid gold" },
        { key: STAT_KEYS.otherGold, label: "Other gold (+ quick log)" },
        { key: STAT_KEYS.total, label: "Total this week" },
        { key: STAT_KEYS.leftToUse, label: "Left to use" },
      ],
    },
    {
      title: "This week",
      items: [...taskItems("week"), { key: CHARACTER_BOUND_KEY, label: "Character-bound gold" }],
    },
    {
      title: "Today",
      items: [{ key: SECTION_KEYS.today, label: "Show the Today card", strong: true }, ...taskItems("today")],
    },
    {
      title: "Any time",
      items: [{ key: SECTION_KEYS.anytime, label: "Show the Any time card", strong: true }, ...taskItems("anytime")],
    },
    {
      title: "Widgets",
      items: [
        { key: WIDGET_KEYS.goldMonth, label: "Gold, past month" },
        { key: WIDGET_KEYS.goldGoal, label: "Gold goal" },
        { key: WIDGET_KEYS.gems, label: "Gem progress (Lv9 / Lv10)" },
        { key: WIDGET_KEYS.news, label: "Lost Ark news & servers" },
      ],
    },
    {
      title: "Also",
      items: [
        { key: SECTION_KEYS.recap, label: "New-week recap" },
        { key: FINISHED_ROWS_KEY, label: "Characters who are all done" },
        { key: PAGE_KEYS.gold, label: "Gold page in the menu" },
        { key: PAGE_KEYS.gems, label: "Gems page in the menu" },
      ],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="rounded-lg border border-accent/40 bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Customize the tracker</h2>
          <p className="text-xs text-muted">
            Start from a style, then tick exactly what you want. Saved in this browser.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>

      <StyleChooser current={matchingStyle(hidden, tasks)} onChoose={onStyle} />

      <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{group.title}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.key}>
                  <label className={`flex cursor-pointer items-center gap-2 text-sm ${"strong" in item ? "font-medium" : ""}`}>
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
