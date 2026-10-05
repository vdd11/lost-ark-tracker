"use client";

import { useMemo } from "react";

import { Task } from "@/lib/api";
import { isActiveRaid } from "@/lib/raids";
import {
  DEFAULT_HIDDEN_RAW,
  HIDDEN_PREFERENCE,
  parseHidden,
  serializeHidden,
  Style,
  styleHidden,
} from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";

/** What the tracker shows: Customize choices and the play style, saved in this browser. */
export function useTrackerView(tasks: Task[]) {
  const [hiddenRaw, setHiddenRaw] = usePreference<string>(HIDDEN_PREFERENCE, DEFAULT_HIDDEN_RAW);
  // Whether the "how much do you want to track?" welcome has been answered.
  const [styleChosen, setStyleChosen] = usePreference<boolean>("style-chosen", false);
  const hidden = useMemo(() => parseHidden(hiddenRaw), [hiddenRaw]);
  const isShown = (key: string) => !hidden.has(key);

  function applyStyle(style: Style) {
    setHiddenRaw(serializeHidden(styleHidden(style, tasks.filter((t) => t.category !== "raid" || isActiveRaid(t)))));
    setStyleChosen(true);
  }

  /** Save Customize's draft: what's hidden, and whether a play style was picked. */
  function saveHidden(next: Set<string>, chosenStyle: boolean) {
    setHiddenRaw(serializeHidden(next));
    if (chosenStyle) setStyleChosen(true);
  }

  function setVisible(key: string, visible: boolean) {
    const next = new Set(hidden);
    if (visible) next.delete(key);
    else next.add(key);
    setHiddenRaw(serializeHidden(next));
  }

  return { hidden, isShown, setVisible, saveHidden, applyStyle, styleChosen, setStyleChosen };
}

export type TrackerView = ReturnType<typeof useTrackerView>;
