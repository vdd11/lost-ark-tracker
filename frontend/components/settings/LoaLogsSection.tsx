"use client";

import { FileSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { LOA_KEYS } from "@/lib/loaLogs";
import { usePreference } from "@/lib/usePreference";

/**
 * Opt-in import of raid clears from LOA Logs' local database. Read-only and
 * local: nothing goes online, and clears are only ticked after you review them.
 */
export default function LoaLogsSection() {
  const [enabled, setEnabled] = usePreference<boolean>(LOA_KEYS.enabled, false);
  const [path, setPath] = usePreference<string>(LOA_KEYS.path, "");
  const [, setMapping] = usePreference<string>(LOA_KEYS.mapping, "{}");
  const [usual, setUsual] = useState<{ path: string | null; exists: boolean } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api<{ path: string | null; exists: boolean }>("/loa-logs/default-path")
      .then(setUsual)
      .catch(() => setUsual(null));
  }, [enabled]);

  const shown = draft ?? (path || usual?.path || "");

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <FileSearch size={20} /> LOA Logs import
      </h2>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        If you run the LOA Logs DPS meter (Windows or Linux), the tracker can read the raids it saw you clear this
        week and tick them after you review them. It only reads LOA Logs&apos; database on this computer, never writes
        to it, and doesn&apos;t go online.
      </p>
      <label className="mb-3 flex max-w-3xl cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
        <span className="text-sm font-medium">Show &quot;Import clears&quot; on the tracker</span>
      </label>
      {enabled && (
        <div className="max-w-3xl space-y-2 text-sm">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Path to LOA Logs&apos; encounters.db
            <input
              value={shown}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => {
                // Read the field itself: the draft state may not have caught up yet.
                const value = e.target.value.trim();
                if (value !== (path || usual?.path || "")) setPath(value);
                setDraft(null);
              }}
              placeholder="C:\\Users\\you\\AppData\\Local\\LOA Logs\\encounters.db"
              className="font-mono text-xs text-foreground"
            />
          </label>
          <p className="text-xs text-muted">
            {path
              ? "Using the path above."
              : usual?.exists
                ? "Found LOA Logs in its usual place."
                : "LOA Logs wasn't found in its usual place; it keeps encounters.db in the folder where LOA Logs is installed."}{" "}
            <button onClick={() => setMapping("{}")} className="underline hover:text-foreground">
              Forget my boss → raid choices
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
