"use client";

import { ChangeEvent, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { useUndo } from "@/components/Toast";
import { api, send } from "@/lib/api";
import GameIcon from "@/components/GameIcon";

/** Browser choices that belong to a roster, cleared by a reset so first-run setup shows again. */
const RESET_PREFERENCES = ["first-run", "style-chosen", "tracker-account", "tracker-hidden", "check-in-dismissed-week", "recap-dismissed-week"];

export default function BackupSection({ onError, onRestored }: { onError: (error: string) => void; onRestored: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const offerUndo = useUndo();

  /** Everything gone, setup from scratch; Undo puts the data back (from a copy taken just before). */
  async function resetEverything() {
    try {
      const before = await api<object>("/backup");
      await send("POST", "/reset");
      for (const key of RESET_PREFERENCES) {
        try {
          localStorage.removeItem(`lost-ark-tracker:${key}`);
        } catch {}
      }
      setResetting(false);
      setConfirmText("");
      setMessage("Everything was reset. Open the Tracker to set up your roster.");
      onRestored();
      offerUndo("Everything was reset", async () => {
        await send("POST", "/backup", before);
        setMessage("Your data is back.");
        onRestored();
      });
    } catch (e) {
      onError(describeError(e));
    }
  }

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
      <h2 className="flex items-center gap-2 mb-1 text-2xl font-bold">
          <GameIcon name="backup" size={32} framed alt="" /> Backup &amp; restore
        </h2>
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
        <button onClick={() => setResetting((v) => !v)} className="rounded-md border border-danger/50 px-3 py-1.5 text-danger hover:bg-danger/10">
          Reset everything…
        </button>
        {message && <span className="text-done">{message}</span>}
      </div>
      {resetting && (
        <div className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-3 text-sm">
          <p className="mb-2">
            This deletes every character, account, clear, gold and gem entry, and custom task, and starts over like a
            new install. Type <strong>RESET</strong> to confirm.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label="Type RESET to confirm"
              className="w-32"
              autoFocus
            />
            <button
              onClick={resetEverything}
              disabled={confirmText.trim().toUpperCase() !== "RESET"}
              className="rounded-md bg-danger px-3 py-1.5 font-medium text-background disabled:opacity-40"
            >
              Reset everything
            </button>
            <button onClick={() => setResetting(false)} className="rounded-md px-2 py-1.5 text-muted hover:bg-surface-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
