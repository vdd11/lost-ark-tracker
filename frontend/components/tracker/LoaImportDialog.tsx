"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { useUndo } from "@/components/Toast";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { LoaPreview, parseUtc, send, Task } from "@/lib/api";
import { LOA_KEYS, parseMapping } from "@/lib/loaLogs";
import { usePreference } from "@/lib/usePreference";
import GameIcon from "@/components/GameIcon";

const when = (iso: string) =>
  parseUtc(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Review raid clears found in LOA Logs since the last import, map anything
 * unknown, and tick the ones you keep (with Undo). Never ticks on its own.
 */
export default function LoaImportDialog({ data, onClose }: { data: TrackerData; onClose: () => void }) {
  const [path] = usePreference<string>(LOA_KEYS.path, "");
  const [mappingRaw, setMappingRaw] = usePreference<string>(LOA_KEYS.mapping, "{}");
  const [lastImport, setLastImport] = usePreference<string>(LOA_KEYS.lastImport, "");
  const [preview, setPreview] = useState<LoaPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const offerUndo = useUndo();
  const raids = data.tasks.filter((t: Task) => t.category === "raid" && !t.archived);

  const load = useCallback(() => {
    send<LoaPreview>("POST", "/loa-logs/preview", {
      path: path || null,
      since: lastImport || null,
      mapping: parseMapping(mappingRaw),
    })
      .then((result) => {
        setPreview(result);
        setProblem(null);
      })
      .catch((e) => setProblem(describeError(e)));
  }, [path, lastImport, mappingRaw]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const key = (c: { character_id: number; task_id: number }) => `${c.character_id}:${c.task_id}`;
  const toTick = (preview?.clears ?? []).filter((c) => !c.already_done && !skipped.has(key(c)));

  function mapBoss(boss: string, taskId: number) {
    setMappingRaw(JSON.stringify({ ...parseMapping(mappingRaw), [boss]: taskId }));
  }

  async function apply() {
    setApplying(true);
    const done: typeof toTick = [];
    try {
      for (const clear of toTick) {
        // Some gates only (or at different difficulties): clear just those.
        const body = clear.gates ? { gates: clear.gates } : { difficulty_id: clear.difficulty_id };
        await send("PUT", `/characters/${clear.character_id}/tasks/${clear.task_id}/completion`, body);
        done.push(clear);
      }
      const previousImport = lastImport;
      setLastImport(new Date().toISOString());
      offerUndo(`Ticked ${done.length} clear${done.length === 1 ? "" : "s"} from LOA Logs`, async () => {
        for (const clear of done) await send("DELETE", `/characters/${clear.character_id}/tasks/${clear.task_id}/completion`);
        // So the next import offers these clears again.
        setLastImport(previousImport);
        data.refreshTracker();
        data.loadWeeklyGold();
      });
      onClose();
    } catch (e) {
      setProblem(describeError(e));
    } finally {
      setApplying(false);
      data.refreshTracker();
      data.loadWeeklyGold();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loa-import-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="loa-import-title" className="flex items-center gap-2 font-semibold">
              <GameIcon name="loa-logs" size={24} alt="" /> Import clears from LOA Logs
            </h2>
            {preview && (
              <p className="text-xs text-muted">
                Since {lastImport ? `your last import (${when(lastImport)})` : "this week's reset"}, from {preview.path}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>

        {problem && <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{problem}</p>}
        {!preview && !problem && <p className="text-sm text-muted">Reading LOA Logs…</p>}

        {preview && (
          <div className="space-y-4 text-sm">
            {preview.clears.length === 0 ? (
              <p className="text-muted">No new raid clears found.</p>
            ) : (
              <div>
                <p className="mb-2 font-medium">
                  Found {preview.clears.length} clear{preview.clears.length === 1 ? "" : "s"}
                  {toTick.length !== preview.clears.length && ` (${toTick.length} to tick)`}:
                </p>
                <ul className="space-y-1">
                  {preview.clears.map((clear) => (
                    <li key={key(clear)}>
                      <label className={`flex items-center gap-2 ${clear.already_done ? "text-muted" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          disabled={clear.already_done}
                          checked={!clear.already_done && !skipped.has(key(clear))}
                          onChange={(e) => {
                            const next = new Set(skipped);
                            if (e.target.checked) next.delete(key(clear));
                            else next.add(key(clear));
                            setSkipped(next);
                          }}
                        />
                        <span>
                          <span className="font-medium">{clear.character_name}</span> — {clear.task_name}{" "}
                          {clear.difficulty ?? ""}
                          {clear.gates && ` · ${Object.keys(clear.gates).map((g) => `G${g}`).join(" + ")}`}
                          {clear.difficulty && !clear.difficulty_id && (
                            <span className="text-xs text-accent"> (no such difficulty here; uses their usual one)</span>
                          )}
                          <span className="text-xs text-muted"> · {when(clear.fight_start)}</span>
                          {clear.already_done && <span className="text-xs"> · already ticked</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.unknown_bosses.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Bosses to match</p>
                <p className="mb-2 text-xs text-muted">
                  {preview.raid_map_found
                    ? "These cleared bosses aren't a gate of a raid the tracker knows."
                    : "LOA Logs' raid list wasn't found next to its database, so match the last boss of each raid yourself."}{" "}
                  Pick the raid it finishes, or &quot;Not a raid clear&quot;.
                </p>
                <ul className="space-y-1.5">
                  {preview.unknown_bosses.map((boss) => (
                    <li key={boss} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{boss}</span>
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value !== "" && mapBoss(boss, Number(e.target.value))}
                        aria-label={`Raid for ${boss}`}
                        className="py-0.5 text-xs"
                      >
                        <option value="">Pick…</option>
                        <option value="0">Not a raid clear</option>
                        {raids.map((task) => (
                          <option key={task.id} value={task.id}>{task.name}</option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.unknown_players.length > 0 && (
              <p className="text-xs text-muted">
                Not in your roster (names must match the game): {preview.unknown_players.join(", ")}.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={applying || toTick.length === 0}
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-50"
              >
                {applying ? "Ticking…" : `Tick ${toTick.length} clear${toTick.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
