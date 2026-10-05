"use client";

import { Check, ClipboardCopy, Flame, ListTodo } from "lucide-react";
import { useRef, useState } from "react";

import { cellKeyboard } from "@/components/tracker/cellKeys";
import TrackerCard from "@/components/tracker/TrackerCard";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { formatGold, Task } from "@/lib/api";
import { cellKey } from "@/lib/trackerSections";
import { itemName, whatsLeft, whatsLeftText } from "@/lib/whatsLeft";
import GameIcon from "@/components/GameIcon";
import { classIconName } from "@/lib/data/icons";

/**
 * Only what's left, per character, richest first, with a one-click tick (and
 * Undo) per line and a Discord-friendly "Copy as text".
 */
export default function WhatsLeft({ data, columns }: { data: TrackerData; columns: Task[] }) {
  const groups = whatsLeft({
    roster: data.roster,
    columns,
    tasks: data.tasks,
    completed: data.completed,
    runs: data.runs,
  });
  const [copied, setCopied] = useState(false);
  const fallback = useRef<HTMLTextAreaElement>(null);
  const [showFallback, setShowFallback] = useState(false);
  const count = groups.reduce((sum, g) => sum + g.items.length, 0);
  const gold = groups.reduce((sum, g) => sum + g.gold, 0);
  const text = whatsLeftText(groups);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: show the text selected so it can be copied by hand.
      setShowFallback(true);
      setTimeout(() => fallback.current?.select(), 0);
    }
  }

  return (
    <TrackerCard
      icon={ListTodo}
      title="What's left"
      subtitle={count ? `${count} task${count === 1 ? "" : "s"} · ${formatGold(gold)} gold still to earn` : "All caught up"}
      extra={
        count > 0 ? (
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
            title="Copy a summary for Discord"
          >
            {copied ? <Check size={14} className="text-done" /> : <ClipboardCopy size={14} />}
            {copied ? "Copied" : "Copy as text"}
          </button>
        ) : undefined
      }
    >
      {showFallback && (
        <div className="border-b border-border px-4 py-3">
          <p className="mb-1 text-xs text-muted">Copying isn&apos;t allowed here; select the text and copy it yourself:</p>
          <textarea ref={fallback} readOnly value={text} rows={Math.min(8, groups.length + 1)} className="w-full font-mono text-xs" />
        </div>
      )}

      {groups.length === 0 ? (
        <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted">
          <Check size={16} className="text-done" /> Nothing left. Everyone&apos;s done.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {groups.map(({ character, items, gold: characterGold }) => (
            <li key={character.id} className="px-4 py-3">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <GameIcon name={classIconName(character.class_name)} size={18} alt="" />
                  {character.name} <span className="text-xs font-normal text-muted">{character.class_name}</span>
                </span>
                {characterGold > 0 && <span className="text-xs tabular-nums text-muted">{formatGold(characterGold)}</span>}
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const rested = data.restByCell.get(cellKey(character.id, item.task.id))?.rested_run_available;
                  const toggle = cellKeyboard(character, item.task, data, false).toggle;
                  return (
                    <li key={item.task.id}>
                      <button
                        onClick={toggle}
                        aria-label={`Mark ${itemName(item)} done on ${character.name}`}
                        className="group flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-sm hover:border-done/60 hover:bg-done/10"
                      >
                        <span className="flex h-4 w-4 items-center justify-center rounded border border-muted/60 group-hover:border-done">
                          <Check size={11} className="text-done opacity-0 group-hover:opacity-100" />
                        </span>
                        {itemName(item)}
                        <span className="text-xs text-muted">
                          {item.unknownGold
                            ? "· ? gold"
                            : item.gold > 0
                              ? `· ${formatGold(item.gold)}`
                              : item.task.category === "raid"
                                ? "· no gold"
                                : ""}
                        </span>
                        {item.suggested && (
                          <span className="text-xs italic text-muted" title="Not one of their usual raids: the best they can enter for an open gold slot">
                            suggested
                          </span>
                        )}
                        {rested && (
                          <span className="flex items-center gap-0.5 text-xs text-accent">
                            <GameIcon name="rest" size={12} fallback={Flame} alt="" /> rested
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </TrackerCard>
  );
}
