"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import ContentCell, { RunChanges } from "@/components/ContentCell";
import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import RaidCell from "@/components/RaidCell";
import { usePreference } from "@/lib/usePreference";
import RestGauge from "@/components/RestGauge";
import {
  canRun,
  difficultyOf,
  formatItemLevel,
  GOLD_RAIDS_PER_WEEK,
  isActiveRaid,
  paidRaids,
  possibleRaidGold,
  raidGold,
  shortDifficulty,
} from "@/lib/raids";
import {
  api,
  byPosition,
  CATEGORIES,
  Character,
  formatGold,
  parseUtc,
  RestState,
  Run,
  send,
  Task,
  TrackerState,
  WeeklyGold,
} from "@/lib/api";

type Filter = "all" | "mine" | "friends";
const FILTERS: readonly Filter[] = ["all", "mine", "friends"];

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
  const [filter, setFilter] = usePreference<Filter>("tracker-filter", "all", FILTERS);
  const [editMode, setEditMode] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const loadWeeklyGold = useCallback(() => {
    api<WeeklyGold[]>("/gold/weekly?weeks=1")
      .then((weeks) => setThisWeek(weeks[0]))
      .catch((e) => setError(describeError(e)));
  }, []);

  // Rest, runs and roster limits depend on check-offs, so re-read after changes.
  const refreshTracker = useCallback(() => {
    api<TrackerState>("/tracker")
      .then((trackerData) => {
        setTracker(trackerData);
        setCompleted(new Set(trackerData.completed.map(([c, t]) => cellKey(c, t))));
      })
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
  const runByCell = useMemo(
    () => new Map<string, Run>((tracker?.runs ?? []).map((r) => [cellKey(r.character_id, r.task_id), r])),
    [tracker],
  );
  const namesById = new Map(characters.map((c) => [c.id, c.name]));

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
      .filter((t) => t.category !== "raid" || isActiveRaid(t))
      .filter(
        (t) =>
          editMode ||
          characters.some((c) => c.task_ids.includes(t.id) || (isTiered(t) && t.category === "raid" && canRun(c, t))),
      )
      .sort(byPosition),
  })).filter((group) => group.tasks.length > 0);
  const visibleTasks = columnGroups.flatMap((group) => group.tasks);

  const possibleGold = possibleRaidGold(characters, tasks);

  // Done/total per category across the characters shown, counting only what
  // each character usually does (and can enter).
  const progress = CATEGORIES.map((category) => {
    let done = 0;
    let total = 0;
    for (const character of visibleCharacters) {
      for (const task of tasks) {
        if (task.category !== category.value || !character.task_ids.includes(task.id)) continue;
        if (task.category === "raid" ? !isActiveRaid(task) : isTiered(task) && !canRun(character, task)) continue;
        total += 1;
        if (completed.has(cellKey(character.id, task.id))) done += 1;
      }
    }
    return { ...category, done, total };
  }).filter((group) => group.total > 0);
  const hasUnknownGold = characters.some((c) =>
    tasks.some((t) => isActiveRaid(t) && t.difficulties.length > 0 && c.task_ids.includes(t.id) && raidGold(c, t) === null),
  );

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
      if (task.rest_max > 0) refreshTracker();
    } catch (e) {
      update(wasDone);
      setError(describeError(e));
    }
  }

  /** Check off (or un-check) a raid at a difficulty; works for extra raids too. */
  async function toggleRaid(character: Character, task: Task, done: boolean, difficultyId: number | undefined) {
    try {
      const path = `/characters/${character.id}/tasks/${task.id}/completion`;
      await (done ? send("PUT", path, { difficulty_id: difficultyId ?? null }) : send("DELETE", path));
      loadWeeklyGold();
      refreshTracker();
    } catch (e) {
      setError(describeError(e));
    }
  }

  /** Change the difficulty in a raid cell: the usual one if assigned, and this week's run if done. */
  async function chooseRaidDifficulty(character: Character, task: Task, difficultyId: number, done: boolean) {
    if (character.task_ids.includes(task.id)) await setRaidDifficulty(character, task, difficultyId);
    if (done) await toggleRaid(character, task, true, difficultyId);
  }

  /** Update this week's run of tiered content: runs, sands, lucky rooms. */
  async function updateRun(character: Character, task: Task, changes: RunChanges | null) {
    try {
      const path = `/characters/${character.id}/tasks/${task.id}/completion`;
      await (changes === null ? send("DELETE", path) : send("PUT", path, changes));
      refreshTracker();
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function setRest(character: Character, task: Task, value: number) {
    try {
      await send("PUT", `/characters/${character.id}/tasks/${task.id}/rest`, { value });
      refreshTracker();
    } catch (e) {
      setError(describeError(e));
    }
  }

  /** Pick a raid difficulty for a character, or null to stop running the raid. */
  async function setRaidDifficulty(character: Character, task: Task, difficultyId: number | null) {
    const taskIds = character.task_ids.filter((id) => id !== task.id);
    const difficultyIds = { ...character.difficulty_ids };
    delete difficultyIds[String(task.id)];
    if (difficultyId !== null) {
      taskIds.push(task.id);
      difficultyIds[String(task.id)] = difficultyId;
    }
    const replaceCharacter = (updated: Character) =>
      setCharacters((prev) => prev.map((c) => (c.id === character.id ? updated : c)));

    replaceCharacter({ ...character, task_ids: taskIds, difficulty_ids: difficultyIds });
    try {
      const path = `/characters/${character.id}/tasks/${task.id}`;
      await (difficultyId === null ? send("DELETE", path) : send("PUT", path, { difficulty_id: difficultyId }));
    } catch (e) {
      replaceCharacter(character);
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
          {progress.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              {progress.map((group) => (
                <div key={group.value} className="flex items-center gap-2" title={`${group.label}: ${group.done} of ${group.total} done`}>
                  <span>{group.label}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${group.done === group.total ? "bg-done" : "bg-accent"}`}
                      style={{ width: `${(group.done / group.total) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums">{group.done}/{group.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Stat label="Raid gold this week" value={thisWeek ? formatGold(thisWeek.raid_gold) : "–"} sub={`of ${formatGold(possibleGold)} possible${thisWeek?.bound_gold ? ` · ${formatGold(thisWeek.bound_gold)} bound` : ""}`} />
          <Stat label="Other gold this week" value={thisWeek ? formatGold(thisWeek.other_gold) : "–"} sub={<Link href="/gold" className="underline">log gold</Link>} />
          <Stat label="Total this week" value={thisWeek ? formatGold(thisWeek.total) : "–"} accent />
        </div>
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {hasUnknownGold && (
        <p className="mb-4 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          Some raids your characters run don&apos;t have a gold value yet (shown as ?). Fill them in on the{" "}
          <Link href="/raids" className="underline">Raids page</Link> so your weekly gold adds up.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-border bg-surface p-0.5 text-sm">
          {FILTERS.map((value) => (
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
          Choose each character&apos;s usual tasks and raid difficulties. These count toward &quot;Done&quot; and
          possible gold. Raids a character qualifies for but doesn&apos;t usually run still show faded on the tracker,
          so you can tick an extra clear.
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
                <th className="sticky left-0 min-w-36 bg-surface px-3 py-2 text-left font-medium">Character</th>
                {visibleTasks.map((task, index) => (
                  <th
                    key={task.id}
                    className={`${task.category === "raid" ? "min-w-24" : "min-w-20"} px-2 py-2 text-center align-bottom font-medium ${
                      index === 0 || visibleTasks[index - 1].category !== task.category ? "border-l border-border" : ""
                    }`}
                  >
                    <div className="leading-tight">{task.name}</div>
                    {task.gold > 0 && task.difficulties.length === 0 && (
                      <div className="text-xs font-normal text-accent">{formatGold(task.gold)}g</div>
                    )}
                    {task.ends_on && (
                      <div className="text-xs font-normal text-muted">
                        event, until {new Date(`${task.ends_on}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    )}
                  </th>
                ))}
                <th className="border-l border-border px-3 py-2 text-right font-medium">Done</th>
              </tr>
            </thead>
            <tbody>
              {visibleCharacters.map((character) => {
                // Tiered weeklies the character can't enter yet (e.g. Hourglass under 1730) don't count.
                const rowTasks = visibleTasks.filter(
                  (t) => assigned.has(cellKey(character.id, t.id)) && (t.category === "raid" || !isTiered(t) || canRun(character, t)),
                );
                const rowDone = rowTasks.filter((t) => completed.has(cellKey(character.id, t.id))).length;
                const paidRaidCount = paidRaids(character, tasks).length;

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
                        {character.item_level > 0 && ` · ${formatItemLevel(character.item_level)}`}
                      </div>
                      {paidRaidCount > GOLD_RAIDS_PER_WEEK && (
                        <div className="text-xs text-accent" title="Only the first raids you clear each week pay gold">
                          {paidRaidCount} gold raids, {GOLD_RAIDS_PER_WEEK} pay
                        </div>
                      )}
                    </td>

                    {visibleTasks.map((task, index) => {
                      const key = cellKey(character.id, task.id);
                      const isAssigned = assigned.has(key);
                      const isDone = completed.has(key);
                      const rest = task.rest_max > 0 ? restByCell.get(key) : undefined;
                      const border =
                        index === 0 || visibleTasks[index - 1].category !== task.category ? "border-l border-border" : "";

                      const difficulty = isTiered(task) ? difficultyOf(character, task) : undefined;
                      const run = runByCell.get(key);

                      if (editMode && isTiered(task)) {
                        return (
                          <td key={task.id} className={`px-1 text-center ${border}`}>
                            <select
                              value={isAssigned ? (difficulty?.id ?? "") : ""}
                              onChange={(e) => setRaidDifficulty(character, task, e.target.value ? Number(e.target.value) : null)}
                              aria-label={`${task.name} difficulty for ${character.name}`}
                              className={`w-full py-1 text-xs ${isAssigned ? "border-accent bg-accent/15 font-medium" : "text-muted"}`}
                            >
                              <option value="">–</option>
                              {task.difficulties.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {shortDifficulty(d.name)} · {formatItemLevel(d.min_item_level)}
                                  {d.min_item_level > character.item_level ? " ⚠" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

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

                      if (task.category === "raid" && isTiered(task)) {
                        const otherClear = task.roster_limited
                          ? (tracker?.runs ?? []).find((r) => r.task_id === task.id && r.character_id !== character.id)
                          : undefined;
                        return (
                          <td key={task.id} className={`p-0 text-center ${border}`}>
                            {isAssigned || canRun(character, task) ? (
                              <RaidCell
                                task={task}
                                character={character}
                                isAssigned={isAssigned}
                                run={run}
                                clearedBy={otherClear ? namesById.get(otherClear.character_id) : undefined}
                                onToggle={(done, difficultyId) => toggleRaid(character, task, done, difficultyId)}
                                onDifficulty={(difficultyId, done) => chooseRaidDifficulty(character, task, difficultyId, done)}
                              />
                            ) : (
                              <span className="text-muted/50">–</span>
                            )}
                          </td>
                        );
                      }

                      if (isTiered(task)) {
                        return (
                          <td key={task.id} className={`p-0 text-center ${border}`}>
                            {isAssigned && canRun(character, task) ? (
                              <ContentCell
                                task={task}
                                character={character}
                                tier={difficulty}
                                run={run}
                                onChange={(changes) => updateRun(character, task, changes)}
                                onRemove={() => updateRun(character, task, null)}
                              />
                            ) : (
                              <span className="text-muted/50" title={`${task.name} unlocks at a higher item level`}>–</span>
                            )}
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

/** Tasks split into tiers: raid difficulties or cube unlocks. */
function isTiered(task: Task) {
  return task.difficulties.length > 0;
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
