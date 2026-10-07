"use client";

import { ExternalLink, Plus } from "lucide-react";

import GameIcon from "@/components/GameIcon";
import { libraryOffers, LibraryTask } from "@/lib/data/taskLibrary";

/**
 * Settings → Tasks → "Add from the library": optional tasks in one click,
 * each with its rule's source. A per-character entry becomes a tracker task;
 * a roster-wide one, a counter that resets (Counters widget).
 */
export default function TaskLibrary({
  taskNames,
  onAddTask,
  onAddCounter,
}: {
  taskNames: string[];
  onAddTask: (data: { name: string; category: string; run_limit: number }) => void;
  onAddCounter: (data: { name: string; target: number | null; resets: string }) => void;
}) {
  const offers = libraryOffers(taskNames);
  if (offers.length === 0) return null;

  function add(entry: LibraryTask) {
    if (entry.scope === "roster") onAddCounter({ name: entry.name, target: entry.limit || null, resets: entry.category });
    else onAddTask({ name: entry.name, category: entry.category, run_limit: entry.limit });
  }

  return (
    <div className="mb-4 rounded-md border border-border bg-surface">
      <h3 className="border-b border-border px-3 py-2 font-semibold">Add from the library</h3>
      <ul>
        {offers.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0">
            <GameIcon name={entry.icon} size={24} framed alt="" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {entry.name}{" "}
                <span className="text-xs font-normal text-muted">
                  {entry.category === "daily" ? "daily" : "weekly"}
                  {entry.limit ? ` · ${entry.limit} per ${entry.category === "daily" ? "day" : "week"}` : ""}
                  {entry.scope === "roster" ? " · roster-wide" : " · per character"}
                </span>
              </div>
              <p className="text-xs text-muted">{entry.description}</p>
              <a href={entry.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted underline hover:text-foreground">
                {entry.source.label}, checked {entry.source.checked} <ExternalLink size={11} />
              </a>
            </div>
            <button
              type="button"
              onClick={() => add(entry)}
              disabled={entry.added}
              aria-label={entry.added ? `${entry.name} is added` : `Add ${entry.name}`}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
            >
              {entry.added ? "Added" : <><Plus size={12} /> Add</>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
