"use client";

import { useCallback, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import NumberInput from "@/components/NumberInput";
import EventForm from "@/components/settings/EventForm";
import { api, CatalogReference, Difficulty, formatGold, send, Task } from "@/lib/api";
import { boundLabel, formatItemLevel, settingsRaidLists } from "@/lib/raids";

const formatDate = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString();

/**
 * Raids in Settings: the built-in values as a read-only reference (they come
 * with app updates), and the event raids you add yourself.
 */
export default function RaidsSection({ dataVersion, onError }: { dataVersion: number; onError: (error: string) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reference, setReference] = useState<CatalogReference | null>(null);

  const load = useCallback(() => {
    Promise.all([api<Task[]>("/tasks?include_archived=true"), api<CatalogReference>("/raid-catalog")])
      .then(([taskData, referenceData]) => {
        setTasks(taskData);
        setReference(referenceData);
      })
      .catch((e) => onError(describeError(e)));
  }, [onError]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      load();
    } catch (e) {
      onError(describeError(e));
    }
  }

  const { live, past, custom, hidden } = settingsRaidLists(tasks);

  function remove(task: Task) {
    if (confirm(`Delete "${task.name}"? Gold already earned from it stays in your history.`)) {
      mutate(() => send("DELETE", `/tasks/${task.id}`));
    }
  }

  return (
    <section id="raids" className="scroll-mt-4">
      <h2 className="mb-1 text-2xl font-bold">Raids</h2>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Raid item levels, gold and bonus box costs come with each app update, so they&apos;re always the current
        patch&apos;s. Which raids each character runs is set with <strong>Edit who does what</strong> on the tracker.
        {reference && <> Raid data last reviewed: {formatDate(reference.reviewed)}.</>}
      </p>

      {reference && (
        <details className="mb-6 rounded-md border border-border bg-surface">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">Raid reference</summary>
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full max-w-4xl whitespace-nowrap text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Raid</th>
                  <th className="px-2 py-2 font-medium">Difficulty</th>
                  <th className="px-2 py-2 text-right font-medium">Item level</th>
                  <th className="px-2 py-2 text-right font-medium">Gold</th>
                  <th className="px-2 py-2 font-medium" title="Share of the gold that's bound, and to the roster or the character">Bound</th>
                  <th className="px-4 py-2 text-right font-medium" title="Gold to open every gate's bonus (View More) box">Bonus boxes</th>
                </tr>
              </thead>
              <tbody>
                {reference.raids.map((raid) =>
                  raid.difficulties.map((d, index) => (
                    <tr key={`${raid.name}-${d.name}`} className={index === 0 ? "border-t border-border" : ""}>
                      <td className="px-4 py-1.5 font-medium">{index === 0 ? raid.name : ""}</td>
                      <td className="px-2 py-1.5">{d.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatItemLevel(d.item_level)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{d.gold === null ? "?" : formatGold(d.gold)}</td>
                      <td className="px-2 py-1.5 text-muted">{boundLabel(d.bound_percent, d.bound_kind) || "–"}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">{d.bonus_cost === null ? "?" : formatGold(d.bonus_cost)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <h3 className="mb-1 text-lg font-semibold">Event raids</h3>
      <p className="mb-3 max-w-3xl text-sm text-muted">
        Limited-time raids such as an Extreme mode. Add one when it goes live; it leaves the tracker when it ends.
      </p>
      <div className="space-y-3">
        <EventForm onCreate={(data) => mutate(() => send("POST", "/event-raids", data))} onError={onError} />
        {live.map((task) => (
          <RaidRow key={task.id} task={task} onDelete={() => remove(task)} mutate={mutate} />
        ))}
        {custom.map((task) => (
          <RaidRow key={task.id} task={task} onDelete={() => remove(task)} mutate={mutate} />
        ))}
        {live.length === 0 && custom.length === 0 && <p className="text-sm text-muted">No event raids running.</p>}
        {(past.length > 0 || hidden.length > 0) && (
          <ul className="space-y-1.5 text-sm">
            {past.map((task) => (
              <li key={task.id} className="flex items-center gap-3">
                <span>
                  {task.name} <span className="text-muted">ended {formatDate(task.ends_on!)}</span>
                </span>
              </li>
            ))}
            {hidden.map((task) => (
              <li key={task.id} className="flex items-center gap-3">
                <span>
                  {task.name} <span className="text-muted">hidden</span>
                </span>
                <button
                  onClick={() => mutate(() => send("PATCH", `/tasks/${task.id}`, { archived: false }))}
                  className="rounded border border-border px-2 py-0.5 hover:bg-surface-2"
                >
                  Show again
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** An event (or older custom) raid: its difficulties, with gold you can fill in. */
function RaidRow({ task, onDelete, mutate }: { task: Task; onDelete: () => void; mutate: (action: () => Promise<unknown>) => void }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {task.name}
          {task.ends_on && (
            <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
              until {formatDate(task.ends_on)}
            </span>
          )}
        </span>
        <button onClick={onDelete} className="rounded px-2 py-0.5 text-danger hover:bg-danger/10">
          Delete
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
        {task.difficulties.map((d) => (
          <GoldInput key={`${d.id}-${d.gold}`} difficulty={d} mutate={mutate} />
        ))}
      </div>
    </div>
  );
}

function GoldInput({ difficulty, mutate }: { difficulty: Difficulty; mutate: (action: () => Promise<unknown>) => void }) {
  const [gold, setGold] = useState(difficulty.gold === null ? "" : String(difficulty.gold));

  function save() {
    const value = gold.trim() === "" ? null : Math.max(0, Math.round(Number(gold)));
    if (value !== difficulty.gold && (value === null || Number.isFinite(value))) {
      mutate(() => send("PATCH", `/difficulties/${difficulty.id}`, { gold: value }));
    }
  }

  return (
    <label className="flex items-center gap-2">
      <span>
        {difficulty.name} <span className="text-muted">{formatItemLevel(difficulty.min_item_level)}</span>
      </span>
      <NumberInput
        placeholder="?"
        value={gold}
        onChange={setGold}
        onBlur={save}
        aria-label={`${difficulty.name} gold`}
        className={`w-24 ${difficulty.gold === null ? "border-accent" : ""}`}
      />
    </label>
  );
}
