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

/**
 * Where a dragged tile lands in a grid: the index of the tile whose center
 * is nearest the pointer. `centers` are the tiles' centers in current order.
 */
export function nearestIndex(centers: { x: number; y: number }[], pointer: { x: number; y: number }) {
  let best = 0;
  let bestDistance = Infinity;
  centers.forEach((center, index) => {
    const distance = (center.x - pointer.x) ** 2 + (center.y - pointer.y) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * A saved order of keys, kept in step with the keys that exist now: unknown
 * saved keys are dropped and new keys go where they are in `defaults`.
 */
export function mergeOrder(saved: string[], defaults: string[]): string[] {
  const known = saved.filter((key, index) => defaults.includes(key) && saved.indexOf(key) === index);
  const result = [...known];
  defaults.forEach((key, index) => {
    if (result.includes(key)) return;
    // Put a new key after the default that comes before it, if that one is placed.
    const before = defaults.slice(0, index).reverse().find((k) => result.includes(k));
    result.splice(before ? result.indexOf(before) + 1 : 0, 0, key);
  });
  return result;
}
