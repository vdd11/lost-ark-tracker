/** Keyboard shortcuts: the pure parts (what a key means), kept apart from the DOM. */

/** Fields where keys are typing, not shortcuts. */
export function isTypingTarget(target: { tagName?: string; type?: string; isContentEditable?: boolean } | null) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  // Checkboxes and buttons don't take text.
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes((target.type ?? "text").toLowerCase());
}

export type GridPosition = { row: number; col: number };

/** Where the arrow keys / Home / End move a grid focus, clamped to the grid. Null for other keys. */
export function moveFocus(position: GridPosition, key: string, rows: number, cols: number): GridPosition | null {
  const clamp = (value: number, max: number) => Math.max(0, Math.min(max - 1, value));
  const { row, col } = position;
  switch (key) {
    case "ArrowUp":
      return { row: clamp(row - 1, rows), col };
    case "ArrowDown":
      return { row: clamp(row + 1, rows), col };
    case "ArrowLeft":
      return { row, col: clamp(col - 1, cols) };
    case "ArrowRight":
      return { row, col: clamp(col + 1, cols) };
    case "Home":
      return { row, col: 0 };
    case "End":
      return { row, col: cols - 1 };
    default:
      return null;
  }
}

/** `g` then one of these keys jumps to a page. */
export const GO_TO: Record<string, { path: string; label: string }> = {
  t: { path: "/", label: "Tracker" },
  g: { path: "/gold/", label: "Gold" },
  m: { path: "/gems/", label: "Gems" },
  o: { path: "/tools/", label: "Tools" },
  u: { path: "/guides/", label: "Guides" },
  s: { path: "/settings/", label: "Settings" },
};

/** How long after `g` the second key still counts. */
export const SEQUENCE_MS = 1500;

export type ShortcutState = { pendingSince: number | null };
export type ShortcutAction = { type: "navigate"; path: string } | { type: "help" } | { type: "none" };

/**
 * One key press of the global shortcuts (`g` then a page key, `?` for help).
 * Callers skip typing targets and modified keys before calling this.
 */
export function globalShortcut(state: ShortcutState, key: string, now: number): { state: ShortcutState; action: ShortcutAction } {
  const pending = state.pendingSince !== null && now - state.pendingSince <= SEQUENCE_MS;
  if (pending) {
    const target = GO_TO[key.toLowerCase()];
    return { state: { pendingSince: null }, action: target ? { type: "navigate", path: target.path } : { type: "none" } };
  }
  if (key === "g" || key === "G") return { state: { pendingSince: now }, action: { type: "none" } };
  if (key === "?") return { state: { pendingSince: null }, action: { type: "help" } };
  return { state: { pendingSince: null }, action: { type: "none" } };
}

/** What a screen reader hears for a tracker cell, e.g. "Serca Nightmare – Alpha – not done". */
export function cellLabel(taskName: string, tierName: string | undefined, characterName: string, status: string) {
  return `${tierName ? `${taskName} ${tierName}` : taskName} – ${characterName} – ${status}`;
}
