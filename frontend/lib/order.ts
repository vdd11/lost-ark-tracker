/** Move one item to a new index, keeping the rest in order. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(items.length - 1, to));
  if (from === target || from < 0 || from >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** Renumber positions 0..n-1 and say which items actually moved (old rows may share position 0). */
export function renumber<T extends { id: number; position: number }>(items: T[]) {
  const ordered = items.map((item, position) => ({ ...item, position }));
  const changed = ordered.filter((item, index) => items[index].position !== item.position);
  return { ordered, changed };
}

/**
 * Where a dragged row lands: the number of other rows whose middle is above
 * the pointer. `middles` are the rows' vertical centers in current order.
 */
export function dropIndex(middles: number[], dragged: number, pointerY: number) {
  return middles.filter((middle, index) => index !== dragged && middle < pointerY).length;
}
