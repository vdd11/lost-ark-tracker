"use client";

import { KeyboardEvent, PointerEvent, useRef, useState } from "react";

import { dropIndex, moveItem } from "@/lib/order";

/**
 * Drag a row by its handle to reorder a list (mouse, pen or touch). Rows move
 * live while dragging and `onReorder` gets the new order on release. The
 * handle also takes the arrow keys, so it works from the keyboard too.
 */
export function useDragReorder<T extends { id: number }>(items: T[], onReorder: (ordered: T[]) => void) {
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
        event.currentTarget.setPointerCapture(event.pointerId);
        update({ id: item.id, order: items });
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const current = dragRef.current;
        if (!current || current.id !== item.id) return;
        const middles = current.order.map((row) => {
          const rect = rows.current.get(row.id)?.getBoundingClientRect();
          return rect ? rect.top + rect.height / 2 : 0;
        });
        const from = current.order.findIndex((row) => row.id === item.id);
        const to = dropIndex(middles, from, event.clientY);
        if (to !== from) update({ id: item.id, order: moveItem(current.order, from, to) });
      },
      onPointerUp() {
        const current = dragRef.current;
        update(null);
        if (current && current.order.some((row, index) => row.id !== items[index]?.id)) onReorder(current.order);
      },
      onPointerCancel() {
        update(null);
      },
      onKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const from = items.findIndex((row) => row.id === item.id);
        const next = moveItem(items, from, from + (event.key === "ArrowUp" ? -1 : 1));
        if (next !== items) onReorder(next);
      },
    };
  }

  return { order: drag?.order ?? items, draggingId: drag?.id ?? null, rowRef, handleProps };
}
