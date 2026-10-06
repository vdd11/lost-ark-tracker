import { Move, X } from "lucide-react";
import { useEffect, useState } from "react";

import StyleChooser from "@/components/tracker/StyleChooser";
import { Task } from "@/lib/api";
import { COUNTERS_PREFERENCE } from "@/lib/counters";
import { CustomizeDraft, draftChanged, isItemShown, toggleItem } from "@/lib/customizeDraft";
import { NEWS_PREFERENCE } from "@/lib/online";
import { RAID_GROUPS_PREFERENCE } from "@/lib/raidGroups";
import { RESET_CLOCK_PREFERENCE } from "@/lib/resetClock";
import { usePreference } from "@/lib/usePreference";
import {
  CHARACTER_BOUND_KEY,
  FINISHED_ROWS_KEY,
  matchingStyle,
  PAGE_KEYS,
  RAID_PICKERS_KEY,
  SECTION_KEYS,
  sectionOf,
  STAT_KEYS,
  Style,
  styleHidden,
  viewKey,
  WIDGET_KEYS,
} from "@/lib/trackerView";
import { FIELD_EVENTS_PREFERENCE } from "@/lib/fieldEvents";

/**
 * Choose what the tracker shows. Changes are a draft until Save; Cancel (or
 * Esc) throws them away. Saved in this browser only.
 */
export default function CustomizePanel({
  tasks,
  hidden,
  onSave,
  onClose,
  onArrange,
}: {
  tasks: Task[];
  hidden: Set<string>;
  /** Apply the saved draft: the new hidden set, and whether a style was picked. */
  onSave: (hidden: Set<string>, styleChosen: boolean) => void;
  onClose: () => void;
  /** Close and start rearranging the page's blocks. */
  onArrange: () => void;
}) {
  // The news widget goes online, so it has its own opt-in switch rather than a spot in the hidden set.
  const [newsOn, setNewsOn] = usePreference<boolean>(NEWS_PREFERENCE, false);
  const [resetClockOn, setResetClockOn] = usePreference<boolean>(RESET_CLOCK_PREFERENCE, false);
  const [countersOn, setCountersOn] = usePreference<boolean>(COUNTERS_PREFERENCE, false);
  const [groupsOn, setGroupsOn] = usePreference<boolean>(RAID_GROUPS_PREFERENCE, false);
  const [fieldEventsOn, setFieldEventsOn] = usePreference<boolean>(FIELD_EVENTS_PREFERENCE, false);
  // Opt-in widgets keep their own on/off switch instead of a spot in the hidden list.
  const optInSetters: Record<string, (on: boolean) => void> = {
    [NEWS_PREFERENCE]: setNewsOn,
    [RESET_CLOCK_PREFERENCE]: setResetClockOn,
    [COUNTERS_PREFERENCE]: setCountersOn,
    [RAID_GROUPS_PREFERENCE]: setGroupsOn,
    [FIELD_EVENTS_PREFERENCE]: setFieldEventsOn,
  };
  const saved: CustomizeDraft = {
    hidden,
    optIn: {
      [NEWS_PREFERENCE]: newsOn,
      [RESET_CLOCK_PREFERENCE]: resetClockOn,
      [COUNTERS_PREFERENCE]: countersOn,
      [RAID_GROUPS_PREFERENCE]: groupsOn,
      [FIELD_EVENTS_PREFERENCE]: fieldEventsOn,
    },
    styleChosen: false,
  };
  const [draft, setDraft] = useState<CustomizeDraft>(saved);
  const changed = draftChanged(saved, draft);
  const isChecked = (key: string) => isItemShown(draft, key);
  const toggle = (key: string, on: boolean) => setDraft((d) => toggleItem(d, key, on));

  function save() {
    onSave(draft.hidden, draft.styleChosen);
    for (const [key, on] of Object.entries(draft.optIn)) if (on !== saved.optIn[key]) optInSetters[key](on);
    onClose();
  }

  function cancel() {
    if (changed && !window.confirm("Discard your Customize changes?")) return;
    onClose();
  }

  // Esc cancels, like closing a dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  const taskItems = (section: string) =>
    tasks.filter((t) => sectionOf(t) === section).map((t) => ({ key: viewKey(t), label: t.name }));

  const groups = [
    {
      title: "Top boxes",
      items: [
        { key: STAT_KEYS.raidsLeft, label: "Gold raids left" },
        { key: STAT_KEYS.raidGold, label: "Gold this week (+ quick log)" },
      ],
    },
    {
      title: "This week",
      items: [
        ...taskItems("week"),
        { key: CHARACTER_BOUND_KEY, label: "Character-bound gold" },
        { key: RAID_PICKERS_KEY, label: "Difficulty pickers on usual raids" },
      ],
    },
    {
      title: "Today",
      items: [
        { key: SECTION_KEYS.today, label: "Show the Today card", strong: true },
        ...taskItems("today"),
        { key: FIELD_EVENTS_PREFERENCE, label: "Field Boss & Chaos Gate: log your drops" },
      ],
    },
    {
      title: "Ebony Cube",
      items: [{ key: SECTION_KEYS.anytime, label: "Show the Ebony Cube card", strong: true }, ...taskItems("anytime")],
    },
    {
      title: "Widgets",
      items: [
        { key: WIDGET_KEYS.goldMonth, label: "Gold, past month" },
        { key: WIDGET_KEYS.goldGoal, label: "Gold goal" },
        { key: WIDGET_KEYS.gems, label: "Gem progress (Lv9 / Lv10)" },
        { key: WIDGET_KEYS.auction, label: "Auction calculator" },
        { key: RESET_CLOCK_PREFERENCE, label: "Reset clock (your time and UTC)" },
        { key: COUNTERS_PREFERENCE, label: "Counters you keep by hand" },
        { key: RAID_GROUPS_PREFERENCE, label: "Raid groups (statics)" },
        { key: NEWS_PREFERENCE, label: "Lost Ark news & servers (goes online)" },
      ],
    },
    {
      title: "Also",
      items: [
        { key: SECTION_KEYS.recap, label: "New-week recap" },
        { key: FINISHED_ROWS_KEY, label: "Characters who are all done" },
        { key: PAGE_KEYS.gold, label: "Gold page in the menu" },
        { key: PAGE_KEYS.gems, label: "Gems page in the menu" },
        { key: PAGE_KEYS.tools, label: "Tools page in the menu" },
        { key: PAGE_KEYS.guides, label: "Guides page in the menu" },
      ],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <section className="rounded-lg border border-accent/40 bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Customize the tracker</h2>
          <p className="text-xs text-muted">
            Start from a style, then tick exactly what you want, and Save. Saved in this browser.
          </p>
        </div>
        <button onClick={cancel} aria-label="Close" title="Close (same as Cancel)" className="rounded-md p-1 text-muted hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>

      <StyleChooser
        current={matchingStyle(draft.hidden, tasks)}
        onChoose={(style: Style) => setDraft((d) => ({ ...d, hidden: styleHidden(style, tasks), styleChosen: true }))}
      />

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
                      checked={isChecked(item.key)}
                      onChange={(e) => toggle(item.key, e.target.checked)}
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

      <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex flex-wrap items-center gap-2 rounded-b-lg border-t border-border bg-surface px-4 py-3">
        <button
          onClick={() => {
            if (changed && !window.confirm("Discard your Customize changes and rearrange the page?")) return;
            onArrange();
          }}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          title="Drag the tracker's blocks and widgets into the order you like"
        >
          <Move size={14} /> Rearrange the page
        </button>
        {changed && <span className="text-xs text-accent">Unsaved changes</span>}
        <span className="ml-auto flex gap-2">
          <button onClick={cancel} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
            Cancel
          </button>
          <button onClick={save} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background">
            Save
          </button>
        </span>
      </div>
    </section>
  );
}
