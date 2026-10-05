/**
 * Customize edits a draft: what's hidden and which opt-in widgets are on.
 * Nothing changes on the tracker until Save; Cancel throws the draft away.
 */
export type CustomizeDraft = {
  hidden: Set<string>;
  /** Opt-in widgets (news, reset clock, counters, raid groups): preference key -> on. */
  optIn: Record<string, boolean>;
  /** Whether a play style was picked in this draft. */
  styleChosen: boolean;
};

/** Tick or untick one item: an opt-in widget's switch, or a spot in the hidden set. */
export function toggleItem(draft: CustomizeDraft, key: string, shown: boolean): CustomizeDraft {
  if (key in draft.optIn) return { ...draft, optIn: { ...draft.optIn, [key]: shown } };
  const hidden = new Set(draft.hidden);
  if (shown) hidden.delete(key);
  else hidden.add(key);
  return { ...draft, hidden };
}

export function isItemShown(draft: CustomizeDraft, key: string) {
  return key in draft.optIn ? draft.optIn[key] : !draft.hidden.has(key);
}

/** Whether the draft differs from what's saved (so Cancel should ask first). */
export function draftChanged(saved: CustomizeDraft, draft: CustomizeDraft) {
  if (saved.hidden.size !== draft.hidden.size || [...saved.hidden].some((k) => !draft.hidden.has(k))) return true;
  return Object.keys({ ...saved.optIn, ...draft.optIn }).some((k) => !!saved.optIn[k] !== !!draft.optIn[k]);
}
