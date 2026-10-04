"use client";

import { useRouter } from "next/navigation";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import ShortcutHelp from "@/components/ShortcutHelp";
import { globalShortcut, isTypingTarget, ShortcutState } from "@/lib/shortcuts";

const HelpContext = createContext<() => void>(() => {});

/** Open the keyboard cheat sheet (e.g. from the menu's keyboard button). */
export function useShortcutHelp() {
  return useContext(HelpContext);
}

/**
 * Shortcuts that work on every page: `g` then a page key to jump, `?` for the
 * cheat sheet. Ignored while typing in a field or with Ctrl / Alt / Cmd held.
 */
export function KeyboardShortcuts({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const state = useRef<ShortcutState>({ pendingSince: null });
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      if (isTypingTarget(event.target as HTMLElement | null)) return;
      const { state: next, action } = globalShortcut(state.current, event.key, Date.now());
      state.current = next;
      if (action.type === "navigate") {
        event.preventDefault();
        router.push(action.path);
      } else if (action.type === "help") {
        event.preventDefault();
        setHelpOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <HelpContext.Provider value={openHelp}>
      {children}
      {helpOpen && <ShortcutHelp onClose={closeHelp} />}
    </HelpContext.Provider>
  );
}
