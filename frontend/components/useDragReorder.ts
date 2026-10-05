"use client";

import { KeyboardEvent, PointerEvent, useRef, useState } from "react";

import { dropIndex, moveItem, nearestIndex } from "@/lib/order";

/**
 * Drag a row by its handle to reorder a list (mouse, pen or touch). Rows move
 * live while dragging and `onReorder` gets the new order on release. The
 * handle also takes the arrow keys, so it works from the keyboard too.
 */
export function useDragReorder<T extends { id: number }>(
  items: T[],
  onReorder: (ordered: T[]) => void,
  /** "grid": tiles in rows and columns land on the nearest tile, and left/right keys move too. */
  layout: "list" | "grid" = "list",
) {
  const [drag, setDrag] = useState<{ id: number; order: T[] } | null>(null);
  // Mirrors `drag` so quick pointer moves between renders see the latest order.
  const dragRef = useRef(drag);
  const rows = useRef(new Map<number, HTMLElement>());

  function update(next: typeof drag) {
    dragRef.current = next;
    setDrag(next);
  }

  const rowRef = (id: number) => (element: HTMLElement | null) => {
    if (element) rows.current.set(id, element);
    else rows.current.delete(id);
  };

  function handleProps(item: T, name: string) {
    return {
      "aria-label": `Reorder ${name}: drag, or use the arrow keys`,
      title: "Drag to reorder",
      style: { touchAction: "none" as const },
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        update({ id: item.id, order: items });
        // No text selection while dragging across the page.
        const userSelect = document.body.style.userSelect;
        document.body.style.userSelect = "none";
        // Follow the pointer on the window, not the handle: when rows reorder,
        // the handle's element can move in the page, which drops pointer capture.
        const move = (e: globalThis.PointerEvent) => {
          const current = dragRef.current;
          if (!current || current.id !== item.id) return;
          const rects = current.order.map((row) => rows.current.get(row.id)?.getBoundingClientRect());
          const from = current.order.findIndex((row) => row.id === item.id);
          const to =
            layout === "grid"
              ? nearestIndex(
                  rects.map((r) => (r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: Infinity, y: Infinity })),
                  { x: e.clientX, y: e.clientY },
                )
              : dropIndex(rects.map((r) => (r ? r.top + r.height / 2 : 0)), from, e.clientY);
          if (to !== from) update({ id: item.id, order: moveItem(current.order, from, to) });
        };
        const end = (e: globalThis.PointerEvent) => {
          document.body.style.userSelect = userSelect;
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
          const current = dragRef.current;
          update(null);
          if (e.type === "pointerup" && current && current.order.some((row, index) => row.id !== items[index]?.id)) {
            onReorder(current.order);
          }
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
      },
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        const back = event.key === "ArrowUp" || (layout === "grid" && event.key === "ArrowLeft");
        const forward = event.key === "ArrowDown" || (layout === "grid" && event.key === "ArrowRight");
        if (!back && !forward) return;
        event.preventDefault();
        const from = items.findIndex((row) => row.id === item.id);
        const next = moveItem(items, from, from + (back ? -1 : 1));
        if (next !== items) onReorder(next);
      },
    };
  }

  return { order: drag?.order ?? items, draggingId: drag?.id ?? null, rowRef, handleProps };
}
