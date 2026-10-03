"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const CHANGE_EVENT = "preference-change";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private window, etc.): use the default
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * A view choice remembered in this browser (filter, chart range, ...).
 * Pre-rendered HTML uses the default; the saved value applies on load.
 * `allowed` guards against stale or hand-edited values.
 */
export function usePreference<T extends string | number | boolean>(
  key: string,
  fallback: T,
  allowed?: readonly T[],
): [T, (value: T) => void] {
  const storageKey = `lost-ark-tracker:${key}`;
  const raw = useSyncExternalStore(subscribe, () => read(storageKey), () => null);

  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      const parsed = JSON.parse(raw) as T;
      if (typeof parsed !== typeof fallback) return fallback;
      return !allowed || allowed.includes(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }, [raw, fallback, allowed]);

  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [storageKey],
  );

  return [value, setValue];
}
