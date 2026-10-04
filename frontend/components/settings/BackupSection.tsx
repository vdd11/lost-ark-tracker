"use client";

import { ChangeEvent, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { api, send } from "@/lib/api";

export default function BackupSection({ onError, onRestored }: { onError: (error: string) => void; onRestored: () => void }) {
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    try {
      const backup = await api<object>("/backup");
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `lost-ark-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(describeError(e));
    }
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!confirm(`Replace ALL current data with "${file.name}"? Download a backup first if you might want it back.`)) return;

    try {
      await send("POST", "/backup", JSON.parse(await file.text()));
      setMessage(`Restored from ${file.name}.`);
      onRestored();
    } catch (e) {
      onError(e instanceof SyntaxError ? "That file isn't valid JSON." : describeError(e));
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Backup &amp; restore</h2>
      <p className="mb-4 text-sm text-muted">
        Your data lives only on this computer. The app also saves a copy each day you open it (the last 10 days),
        in a backups folder next to database.db. Download a backup to move your roster to another machine.
        Restoring replaces everything.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button onClick={download} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
          Download backup
        </button>
        <label className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5">
          Restore from file…
          <input type="file" accept="application/json,.json" onChange={restore} className="hidden" />
        </label>
        {message && <span className="text-done">{message}</span>}
      </div>
    </section>
  );
}
