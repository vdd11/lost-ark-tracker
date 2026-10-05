"use client";

import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { ReactNode } from "react";

import { useDragReorder } from "@/components/useDragReorder";
import { mergeOrder, moveItem } from "@/lib/order";
import { usePreference } from "@/lib/usePreference";

/** Tracker page blocks, top to bottom, and the widgets, in their default order. */
export const PAGE_BLOCKS = ["stats", "recap", "week", "daily", "widgets"] as const;
export const PAGE_ORDER_PREFERENCE = "tracker-block-order";
export const WIDGET_ORDER_PREFERENCE = "tracker-widget-order";

export type Arrangeable = { id: number; key: string; label: string; node: ReactNode };

/**
 * A saved order of keys (per browser), kept in step with the keys that exist.
 * Returns the ordered keys and a setter; an empty saved value is the default.
 */
export function useSavedOrder(preference: string, defaults: string[]) {
  const [raw, setRaw] = usePreference<string>(preference, "");
  const order = mergeOrder(raw ? raw.split("|") : [], defaults);
  return [order, (keys: string[]) => setRaw(keys.join("|"))] as const;
}

/**
 * Blocks that can be dragged (or moved with the buttons and arrow keys) into
 * a new order while arranging. Outside arranging they render as they are.
 */
export function ArrangeableList({
  items,
  onReorder,
  arranging,
  layout = "list",
  className,
}: {
  items: Arrangeable[];
  onReorder: (keys: string[]) => void;
  arranging: boolean;
  layout?: "list" | "grid";
  className?: string;
}) {
  const save = (ordered: Arrangeable[]) => onReorder(ordered.map((item) => item.key));
  const drag = useDragReorder(items, save, layout);
  const shown = drag.order;

  return (
    <div className={className}>
      {shown.map((item, index) => (
        <div
          key={item.key}
          ref={drag.rowRef(item.id)}
          // A block with nothing to show (no recap this week) takes no space unless arranging.
          className={`flex min-w-0 flex-col ${arranging ? "rounded-lg outline-dashed outline-1 outline-offset-4 outline-accent/40" : "empty:hidden"} ${
            drag.draggingId === item.id ? "opacity-70" : ""
          }`}
        >
          {arranging && (
            <div className="mb-1 flex items-center gap-1 text-xs text-muted">
              <button
                {...drag.handleProps(item, item.label)}
                className="flex cursor-grab items-center gap-1 rounded px-1 py-0.5 hover:bg-surface-2 hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical size={14} /> {item.label}
              </button>
              <button
                onClick={() => save(moveItem(shown, index, index - 1))}
                disabled={index === 0}
                aria-label={`Move ${item.label} ${layout === "grid" ? "earlier" : "up"}`}
                className="rounded p-0.5 hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => save(moveItem(shown, index, index + 1))}
                disabled={index === shown.length - 1}
                aria-label={`Move ${item.label} ${layout === "grid" ? "later" : "down"}`}
                className="rounded p-0.5 hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}
          {item.node}
        </div>
      ))}
    </div>
  );
}
