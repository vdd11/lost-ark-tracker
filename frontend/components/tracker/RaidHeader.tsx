"use client";

import { useId, useRef, useState } from "react";

import { Task } from "@/lib/api";
import { raidInfoRows } from "@/lib/raidInfo";

const PANEL_WIDTH = 420;

/**
 * A raid column's name; hover or focus it for each difficulty's item level,
 * gold, bound split and bonus box cost from the catalog. The panel is fixed
 * to the viewport, so the table's scroll area never clips it.
 */
export default function RaidHeader({ task }: { task: Task }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const rows = raidInfoRows(task);
  const gated = task.gate_count > 0;

  function show() {
    const rect = ref.current!.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    setAt({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)) });
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
      onFocus={show}
      onBlur={() => setAt(null)}
      aria-describedby={at ? id : undefined}
      className="cursor-help rounded underline decoration-dotted decoration-muted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {task.name}
      {at && (
        <span
          id={id}
          role="tooltip"
          style={{ top: at.top, left: at.left, width: `min(${PANEL_WIDTH}px, calc(100vw - 16px))` }}
          className="fixed z-40 block rounded-md border border-border bg-surface p-2.5 text-left text-xs font-normal text-foreground shadow-lg"
        >
          <span className="mb-1.5 block font-semibold">{task.name}</span>
          <span className={`grid gap-x-2.5 gap-y-1 whitespace-nowrap tabular-nums ${gated ? "grid-cols-[auto_auto_auto_auto_1fr_auto]" : "grid-cols-[auto_auto_auto_1fr_auto]"}`}>
            <span className="text-muted">Difficulty</span>
            <span className="text-muted">iLvl</span>
            <span className="text-right text-muted">Gold</span>
            {gated && <span className="text-muted">G1 + G2</span>}
            <span className="text-muted">Bound</span>
            <span className="text-right text-muted">Bonus boxes</span>
            {rows.map((row) => (
              <span key={row.difficulty} className="contents">
                <span>{row.difficulty}</span>
                <span>{row.itemLevel}</span>
                <span className="text-right">{row.gold}</span>
                {gated && <span className="text-muted">{row.gates}</span>}
                <span className="text-muted">{row.bound}</span>
                <span className="text-right">{row.bonus}</span>
              </span>
            ))}
          </span>
          {task.note && <span className="mt-1.5 block text-muted">{task.note}</span>}
        </span>
      )}
    </span>
  );
}
