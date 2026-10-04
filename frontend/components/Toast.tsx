"use client";

import { RotateCcw, X } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

const VISIBLE_MS = 6000;
const AFTER_UNDO_MS = 1500;

type Toast = {
  id: number;
  message: string;
  undo: () => Promise<void>;
  status: "ready" | "undoing" | "undone" | "failed";
};

type OfferUndo = (message: string, undo: () => Promise<void>) => void;

const UndoContext = createContext<OfferUndo>(() => {});

/** Offer to take back what just happened: `offerUndo("Serca done on Bardy", () => ...)`. */
export function useUndo() {
  return useContext(UndoContext);
}

/**
 * One toast at a time at the bottom of the screen, with an Undo button. It
 * hides after a few seconds, but not while the pointer or keyboard focus is
 * on it. A newer action replaces it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(1);

  const offerUndo = useCallback<OfferUndo>((message, undo) => {
    setToast({ id: nextId.current++, message, undo, status: "ready" });
  }, []);

  // (Re)start the hide timer whenever the toast changes or stops being hovered.
  useEffect(() => {
    if (!toast || paused || toast.status === "undoing") return;
    const delay = toast.status === "ready" ? VISIBLE_MS : AFTER_UNDO_MS;
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), delay);
    return () => clearTimeout(timer);
  }, [toast, paused]);

  async function runUndo(current: Toast) {
    setToast({ ...current, status: "undoing" });
    try {
      await current.undo();
      setToast((t) => (t?.id === current.id ? { ...current, status: "undone" } : t));
    } catch {
      setToast((t) => (t?.id === current.id ? { ...current, status: "failed" } : t));
    }
  }

  return (
    <UndoContext.Provider value={offerUndo}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toast && (
          <div
            role="status"
            aria-live="polite"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm shadow-lg"
          >
            <span className="min-w-0 truncate">
              {toast.status === "undone" ? "Undone" : toast.status === "failed" ? "Couldn't undo that" : toast.message}
            </span>
            {(toast.status === "ready" || toast.status === "undoing") && (
              <button
                onClick={() => runUndo(toast)}
                disabled={toast.status === "undoing"}
                className="flex shrink-0 items-center gap-1 rounded-md border border-accent/60 px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-60"
              >
                <RotateCcw size={12} />
                {toast.status === "undoing" ? "Undoing…" : "Undo"}
              </button>
            )}
            <button onClick={() => setToast(null)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-muted hover:bg-surface-2">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </UndoContext.Provider>
  );
}
