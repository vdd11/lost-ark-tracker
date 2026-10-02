"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import RestGauge from "@/components/RestGauge";
import {
  api,
  byPosition,
  CATEGORIES,
  Character,
  formatGold,
  parseUtc,
  RestState,
  send,
  Task,
  TrackerState,
  WeeklyGold,
} from "@/lib/api";

type Filter = "all" | "mine" | "friends";

const cellKey = (characterId: number, taskId: number) => `${characterId}:${taskId}`;

function formatCountdown(target: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

export default function TrackerPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tracker, setTracker] = useState<TrackerState | null>(null);
  const [thisWeek, setThisWeek] = useState<WeeklyGold | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [editMode, setEditMode] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const loadWeeklyGold = useCallback(() => {
    api<WeeklyGold[]>("/gold/weekly?weeks=1")
      .then((weeks) => setThisWeek(weeks[0]))
      .catch((e) => setError(describeError(e)));
  }, []);

  // Rest values depend on check-offs, so re-read them after each change.
  const refreshRest = useCallback(() => {
    api<TrackerState>("/tracker")
      .then(setTracker)
      .catch((e) => setError(describeError(e)));
  }, []);

  const loadAll = useCallback(() => {
    Promise.all([
      api<Character[]>("/characters"),
      api<Task[]>("/tasks"),
      api<TrackerState>("/tracker"),
    ])
      .then(([characterData, taskData, trackerData]) => {
        setCharacters(characterData);
        setTasks(taskData);
        setTracker(trackerData);
        setCompleted(new Set(trackerData.completed.map(([c, t]) => cellKey(c, t))));
        setError(null);
      })
      .catch((e) => setError(describeError(e)));
    loadWeeklyGold();
  }, [loadWeeklyGold]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Tick the reset countdowns, and reload once a reset passes so the grid clears.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const nextDailyResetValue = tracker?.next_daily_reset;
  const nextDailyReset = nextDailyResetValue ? parseUtc(nextDailyResetValue) : null;
  useEffect(() => {
    if (nextDailyResetValue && now >= parseUtc(nextDailyResetValue)) loadAll();
  }, [now, nextDailyResetValue, loadAll]);

  const restByCell = useMemo(
    () => new Map<string, RestState>((tracker?.rest ?? []).map((r) => [cellKey(r.character_id, r.task_id), r])),
    [tracker],
  );
  const restedRunsAvailable = tracker?.rest.filter((r) => r.rested_run_available).length ?? 0;

  const assigned = useMemo(
    () => new Set(characters.flatMap((c) => c.task_ids.map((t) => cellKey(c.id, t)))),
    [characters],
  );

  const visibleCharacters = characters
    .filter((c) => filter === "all" || (filter === "friends") === Boolean(c.reserved_for))
    .sort(byPosition);

  // Outside edit mode, hide columns nobody is doing (e.g. raids out of reach).
  const columnGroups = CATEGORIES.map((category) => ({
    ...category,
    tasks: tasks
      .filter((t) => t.category === category.value)
      .filter((t) => editMode || characters.some((c) => c.task_ids.includes(t.id)))
      .sort(byPosition),
  })).filter((group) => group.tasks.length > 0);
  const visibleTasks = columnGroups.flatMap((group) => group.tasks);

  const possibleRaidGold = characters
    .filter((c) => c.is_gold_earner)
    .flatMap((c) => tasks.filter((t) => t.category === "raid" && c.task_ids.includes(t.id)))
    .reduce((sum, t) => sum + t.gold, 0);

  async function toggleCompletion(character: Character, task: Task) {
    const key = cellKey(character.id, task.id);
    const wasDone = completed.has(key);
    const update = (done: boolean) =>
      setCompleted((prev) => {
        const next = new Set(prev);
        if (done) next.add(key);
        else next.delete(key);
        return next;
      });

    update(!wasDone);
    try {
      await send(wasDone ? "DELETE" : "PUT", `/characters/${character.id}/tasks/${task.id}/completion`);
      loadWeeklyGold();
      if (task.rest_max > 0) refreshRest();
    } catch (e) {
      update(wasDone);
      setError(describeError(e));
    }
  }

  async function setRest(character: Character, task: Task, value: number) {
    try {
      await send("PUT", `/characters/${character.id}/tasks/${task.id}/rest`, { value });
      refreshRest();
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function toggleAssignment(character: Character, task: Task) {
    const isAssigned = character.task_ids.includes(task.id);
    const taskIds = isAssigned
      ? character.task_ids.filter((id) => id !== task.id)
      : [...character.task_ids, task.id];
    const setTaskIds = (ids: number[]) =>
      setCharacters((prev) => prev.map((c) => (c.id === character.id ? { ...c, task_ids: ids } : c)));

    setTaskIds(taskIds);
    try {
      await send(isAssigned ? "DELETE" : "PUT", `/characters/${character.id}/tasks/${task.id}`);
    } catch (e) {
      setTaskIds(character.task_ids);
      setError(describeError(e));
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Roster</h1>
          {tracker && nextDailyReset && (
            <p className="mt-1 text-sm text-muted">
              Daily reset in {formatCountdown(nextDailyReset, now)} · Weekly reset in{" "}
              {formatCountdown(parseUtc(tracker.next_weekly_reset), now)}
              {restedRunsAvailable > 0 && (
                <>
                  {" · "}
                  <span className="text-accent">
                    {restedRunsAvailable} rested {restedRunsAvailable === 1 ? "run" : "runs"} available
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Stat label="Raid gold this week" value={thisWeek ? formatGold(thisWeek.raid_gold) : "–"} sub={`of ${formatGold(possibleRaidGold)} possible`} />
          <Stat label="Other gold this week" value={thisWeek ? formatGold(thisWeek.other_gold) : "–"} sub={<Link href="/gold" className="underline">log gold</Link>} />
          <Stat label="Total this week" value={thisWeek ? formatGold(thisWeek.total) : "–"} accent />
        </div>
      </div>

      <ErrorBanner error={error} />

      {characters.length > 0 && tasks.some((t) => t.category === "raid") && tasks.every((t) => t.category !== "raid" || t.gold === 0) && (
        <p className="mb-4 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          Raid gold values aren&apos;t set yet. Enter what each raid pays in{" "}
          <Link href="/settings" className="underline">Settings</Link> so your weekly gold adds up.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-border bg-surface p-0.5 text-sm">
          {(["all", "mine", "friends"] as Filter[]).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded px-3 py-1 ${filter === value ? "bg-surface-2 font-medium" : "text-muted"}`}
            >
              {value === "all" ? "All" : value === "mine" ? "Mine" : "Saved for friends"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setEditMode((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            editMode ? "border-accent bg-accent/15 font-medium" : "border-border bg-surface"
          }`}
        >
          {editMode ? "Done choosing tasks" : "Choose tasks per character"}
        </button>
      </div>

      {editMode && (
        <p className="mb-3 text-sm text-muted">
          Click a cell to toggle whether that character does the task. Unassigned cells show as –.
        </p>
      )}

      {characters.length === 0 && !error ? (
        <p className="rounded-md border border-border bg-surface p-6 text-center text-muted">
          No characters yet. <Link href="/settings" className="underline">Add your roster in Settings</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="sticky left-0 bg-surface" />
                {columnGroups.map((group) => (
                  <th key={group.value} colSpan={group.tasks.length} className="border-l border-border px-2 py-1.5 font-medium">
                    {group.label}
                  </th>
                ))}
                <th className="border-l border-border" />
              </tr>
              <tr className="border-b border-border">
                <th className="sticky left-0 bg-surface px-3 py-2 text-left font-medium">Character</th>
                {visibleTasks.map((task, index) => (
                  <th
                    key={task.id}
                    className={`min-w-20 px-2 py-2 text-center align-bottom font-medium ${
                      index === 0 || visibleTasks[index - 1].category !== task.category ? "border-l border-border" : ""
                    }`}
                  >
                    <div className="leading-tight">{task.name}</div>
                    {task.gold > 0 && <div className="text-xs font-normal text-accent">{formatGold(task.gold)}g</div>}
                  </th>
                ))}
                <th className="border-l border-border px-3 py-2 text-right font-medium">Done</th>
              </tr>
            </thead>
            <tbody>
              {visibleCharacters.map((character) => {
                const rowTasks = visibleTasks.filter((t) => assigned.has(cellKey(character.id, t.id)));
                const rowDone = rowTasks.filter((t) => completed.has(cellKey(character.id, t.id))).length;

                return (
                  <tr key={character.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50">
                    <td className="sticky left-0 bg-surface px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{character.name}</span>
                        {character.is_gold_earner && (
                          <span title="Gold earner" className="rounded bg-accent/15 px-1.5 text-xs font-medium text-accent">G</span>
                        )}
                        {character.reserved_for && (
                          <span className="rounded bg-series-1/15 px-1.5 text-xs text-series-1">
                            for {character.reserved_for}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {character.class_name}
                        {character.item_level > 0 && ` · ${character.item_level}`}
                      </div>
                    </td>

                    {visibleTasks.map((task, index) => {
                      const key = cellKey(character.id, task.id);
                      const isAssigned = assigned.has(key);
                      const isDone = completed.has(key);
                      const rest = task.rest_max > 0 ? restByCell.get(key) : undefined;
                      const border =
                        index === 0 || visibleTasks[index - 1].category !== task.category ? "border-l border-border" : "";

                      if (editMode) {
                        return (
                          <td key={task.id} className={`p-0 text-center ${border}`}>
                            <button
                              onClick={() => toggleAssignment(character, task)}
                              aria-label={`${isAssigned ? "Unassign" : "Assign"} ${task.name} for ${character.name}`}
                              className={`h-12 w-full ${isAssigned ? "bg-accent/15 font-medium text-accent" : "text-muted"}`}
                            >
                              {isAssigned ? "✓" : "–"}
                            </button>
                          </td>
                        );
                      }

                      return (
                        <td key={task.id} className={`p-0 text-center ${border}`}>
                          {isAssigned ? (
                            <div className={isDone ? "bg-done/15" : ""}>
                              <label className={`flex cursor-pointer items-center justify-center ${rest ? "h-8" : "h-12"}`}>
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => toggleCompletion(character, task)}
                                  aria-label={`${task.name} for ${character.name}`}
                                  className="h-4 w-4 cursor-pointer"
                                />
                              </label>
                              {rest && (
                                <RestGauge
                                  task={task}
                                  state={rest}
                                  characterName={character.name}
                                  onSet={(value) => setRest(character, task, value)}
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted/50">–</span>
                          )}
                        </td>
                      );
                    })}

                    <td className={`border-l border-border px-3 py-2 text-right tabular-nums ${rowTasks.length > 0 && rowDone === rowTasks.length ? "text-done" : "text-muted"}`}>
                      {rowDone}/{rowTasks.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-36 rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
