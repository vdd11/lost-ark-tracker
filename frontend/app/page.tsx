"use client";

import { Box, CalendarDays, Coins, Flame, Pencil, Settings2, Sun, Wallet, X } from "lucide-react";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import ContentCell, { RunChanges } from "@/components/ContentCell";
import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import RaidCell from "@/components/RaidCell";
import RestGauge from "@/components/RestGauge";
import CustomizePanel from "@/components/tracker/CustomizePanel";
import TaskTable, { ExtraColumn } from "@/components/tracker/TaskTable";
import TrackerCard from "@/components/tracker/TrackerCard";
import {
  api,
  byPosition,
  Character,
  ExpectedBalances,
  formatGold,
  parseUtc,
  RestState,
  Run,
  send,
  Task,
  TrackerState,
  WeeklyGold,
} from "@/lib/api";
import {
  difficultyOf,
  formatItemLevel,
  GOLD_RAIDS_PER_WEEK,
  isActiveRaid,
  paidRaids,
  possibleRaidGold,
  raidGold,
} from "@/lib/raids";
import {
  appliesTo,
  CHARACTER_BOUND_KEY,
  countsForProgress,
  DEFAULT_HIDDEN,
  parseHidden,
  Section,
  SECTION_KEYS,
  sectionOf,
  serializeHidden,
  viewKey,
} from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";

const cellKey = (characterId: number, taskId: number) => `${characterId}:${taskId}`;

function formatCountdown(target: Date, now: Date) {
  const minutes = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

/** Tasks split into tiers: raid difficulties or cube unlocks. */
function isTiered(task: Task) {
  return task.difficulties.length > 0;
}

export default function TrackerPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tracker, setTracker] = useState<TrackerState | null>(null);
  const [thisWeek, setThisWeek] = useState<WeeklyGold | null>(null);
  // undefined until loaded, null if there has never been a gold check-in.
  const [lastCheckIn, setLastCheckIn] = useState<string | null | undefined>(undefined);
  const [checkInDismissed, setCheckInDismissed] = usePreference<string>("check-in-dismissed-week", "");
  const [hiddenRaw, setHiddenRaw] = usePreference<string>("tracker-hidden", DEFAULT_HIDDEN.join("|"));
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const hidden = useMemo(() => parseHidden(hiddenRaw), [hiddenRaw]);
  const isShown = (key: string) => !hidden.has(key);

  const loadWeeklyGold = useCallback(() => {
    api<WeeklyGold[]>("/gold/weekly?weeks=1")
      .then((weeks) => setThisWeek(weeks[0]))
      .catch((e) => setError(describeError(e)));
    api<ExpectedBalances | null>("/balances/expected")
      .then((data) => setLastCheckIn(data ? data.last_check_in : null))
      .catch(() => {});
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
    Promise.all([api<Character[]>("/characters"), api<Task[]>("/tasks"), api<TrackerState>("/tracker")])
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

  // Tick the reset countdowns, and reload once a reset passes so the cards clear.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const nextDailyResetValue = tracker?.next_daily_reset;
  useEffect(() => {
    if (nextDailyResetValue && now >= parseUtc(nextDailyResetValue)) loadAll();
  }, [now, nextDailyResetValue, loadAll]);

  const restByCell = useMemo(
    () => new Map<string, RestState>((tracker?.rest ?? []).map((r) => [cellKey(r.character_id, r.task_id), r])),
    [tracker],
  );
  const runByCell = useMemo(
    () => new Map<string, Run>((tracker?.runs ?? []).map((r) => [cellKey(r.character_id, r.task_id), r])),
    [tracker],
  );
  const namesById = new Map(characters.map((c) => [c.id, c.name]));
  const roster = [...characters].sort(byPosition);

  /** A card's columns and rows. Outside edit mode, only what applies to someone. */
  function sectionData(section: Section) {
    const columns = tasks
      .filter((t) => sectionOf(t) === section && isShown(viewKey(t)))
      .filter((t) => t.category !== "raid" || isActiveRaid(t))
      .filter((t) => editMode || roster.some((c) => appliesTo(c, t)))
      .sort(byPosition);
    const rows = editMode ? roster : roster.filter((c) => columns.some((t) => appliesTo(c, t)));
    let done = 0;
    let total = 0;
    for (const character of rows) {
      for (const task of columns) {
        if (!countsForProgress(character, task)) continue;
        total += 1;
        if (completed.has(cellKey(character.id, task.id))) done += 1;
      }
    }
    return { columns, rows, done, total };
  }

  const week = sectionData("week");
  const today = sectionData("today");
  const anytime = sectionData("anytime");
  const restedRunsAvailable = (tracker?.rest ?? []).filter(
    (r) => r.rested_run_available && today.columns.some((t) => t.id === r.task_id),
  ).length;

  const possibleGold = possibleRaidGold(characters, tasks);
  const hasUnknownGold = characters.some((c) =>
    tasks.some((t) => isActiveRaid(t) && isTiered(t) && c.task_ids.includes(t.id) && raidGold(c, t) === null),
  );

  // ---------- actions ----------

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

  /** Update this period's run of tiered content: runs, sands, lucky rooms. */
  async function updateRun(character: Character, task: Task, changes: RunChanges | null) {
    try {
      const path = `/characters/${character.id}/tasks/${task.id}/completion`;
      await (changes === null ? send("DELETE", path) : send("PUT", path, changes));
      refreshTracker();
    } catch (e) {
      setError(describeError(e));
    }
  }

  /** Raids that followed the old item level move up a tier, so reload everything. */
  async function updateItemLevel(character: Character, itemLevel: number) {
    try {
      await send("PATCH", `/characters/${character.id}`, { item_level: itemLevel });
      loadAll();
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function setBonus(character: Character, task: Task, bought: boolean) {
    try {
      await send("PUT", `/characters/${character.id}/tasks/${task.id}/completion`, { bought_bonus: bought });
      loadWeeklyGold();
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

  /** Pick a tier for a character, or null to stop doing the task. */
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
    const taskIds = isAssigned ? character.task_ids.filter((id) => id !== task.id) : [...character.task_ids, task.id];
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

  function setVisible(key: string, visible: boolean) {
    const next = new Set(hidden);
    if (visible) next.delete(key);
    else next.add(key);
    setHiddenRaw(serializeHidden(next));
  }

  // ---------- cells ----------

  function renderCell(character: Character, task: Task): ReactNode {
    const key = cellKey(character.id, task.id);
    const isAssigned = character.task_ids.includes(task.id);
    const run = runByCell.get(key);
    const dash = <span className="text-muted/40">–</span>;

    if (editMode) {
      if (isTiered(task)) {
        const difficulty = difficultyOf(character, task);
        return (
          <div className="px-1 py-2">
            <select
              value={isAssigned ? (difficulty?.id ?? "") : ""}
              onChange={(e) => setRaidDifficulty(character, task, e.target.value ? Number(e.target.value) : null)}
              aria-label={`${task.name} for ${character.name}`}
              className={`w-full py-1 text-xs ${isAssigned ? "border-accent bg-accent/15 font-medium" : "text-muted"}`}
            >
              <option value="">Doesn&apos;t run</option>
              {task.difficulties.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({formatItemLevel(d.min_item_level)})
                  {d.min_item_level > character.item_level ? " – too low" : ""}
                </option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <label className="flex cursor-pointer items-center justify-center gap-1.5 py-3 text-xs">
          <input type="checkbox" checked={isAssigned} onChange={() => toggleAssignment(character, task)} className="h-4 w-4" />
          {isAssigned ? "Does it" : "Doesn't"}
        </label>
      );
    }

    if (task.category === "raid" && isTiered(task)) {
      if (!appliesTo(character, task)) return dash;
      const otherClear = task.roster_limited
        ? (tracker?.runs ?? []).find((r) => r.task_id === task.id && r.character_id !== character.id)
        : undefined;
      return (
        <RaidCell
          task={task}
          character={character}
          isAssigned={isAssigned}
          run={run}
          clearedBy={otherClear ? namesById.get(otherClear.character_id) : undefined}
          onToggle={(done, difficultyId) => toggleRaid(character, task, done, difficultyId)}
          onDifficulty={(difficultyId, done) => chooseRaidDifficulty(character, task, difficultyId, done)}
          onBonus={(bought) => setBonus(character, task, bought)}
        />
      );
    }

    if (isTiered(task)) {
      if (!appliesTo(character, task)) return dash;
      return (
        <ContentCell
          task={task}
          character={character}
          tier={difficultyOf(character, task)}
          run={run}
          onChange={(changes) => updateRun(character, task, changes)}
          onRemove={() => updateRun(character, task, null)}
        />
      );
    }

    if (!isAssigned) return dash;
    const isDone = completed.has(key);
    const rest = task.rest_max > 0 ? restByCell.get(key) : undefined;
    return (
      <div className={`flex flex-col items-center gap-1.5 pt-2 ${isDone ? "bg-done/15" : ""} ${rest ? "" : "pb-2"}`}>
        <input
          type="checkbox"
          checked={isDone}
          onChange={() => toggleCompletion(character, task)}
          aria-label={`${task.name} done by ${character.name}`}
          className="h-5 w-5 cursor-pointer"
        />
        {rest && (
          <RestGauge task={task} state={rest} characterName={character.name} onSet={(value) => setRest(character, task, value)} />
        )}
      </div>
    );
  }

  const eventNote = (task: Task) =>
    task.ends_on ? (
      <div className="text-[11px] font-normal text-muted">
        event · until {new Date(`${task.ends_on}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
    ) : null;

  const characterBoundColumn: ExtraColumn = {
    key: "character-bound",
    header: "Char-bound gold",
    title: "Character-bound gold left this week, after bonus boxes bought on that character",
    cell: (character) => {
      const gold = thisWeek?.character_bound[String(character.id)];
      if (!gold) return <span className="text-muted/40">–</span>;
      return (
        <span title={`Earned ${formatGold(gold.earned)}, ${formatGold(gold.spent)} spent on bonus boxes`}>
          <span className="block">{formatGold(gold.left)}</span>
          {gold.spent > 0 && <span className="block text-[11px] text-muted">of {formatGold(gold.earned)}</span>}
        </span>
      );
    },
  };

  const goldRaidWarning = (character: Character) => {
    const count = paidRaids(character, tasks).length;
    return count > GOLD_RAIDS_PER_WEEK ? (
      <div className="text-[11px] text-accent" title="Only the first raids you clear each week pay gold">
        {count} gold raids, {GOLD_RAIDS_PER_WEEK} pay
      </div>
    ) : null;
  };

  const showToday = isShown(SECTION_KEYS.today) && (today.columns.length > 0 || editMode);
  const showAnytime = isShown(SECTION_KEYS.anytime) && (anytime.columns.length > 0 || editMode);
  const needsCheckIn =
    tracker &&
    lastCheckIn !== undefined &&
    checkInDismissed !== tracker.weekly_period &&
    (lastCheckIn === null || parseUtc(lastCheckIn) < parseUtc(`${tracker.weekly_period}T10:00:00`));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Roster</h1>
        <div className="flex gap-2">
          <ToolbarButton active={customizing} onClick={() => setCustomizing((v) => !v)} icon={<Settings2 size={16} />}>
            Customize
          </ToolbarButton>
          <ToolbarButton active={editMode} onClick={() => setEditMode((v) => !v)} icon={<Pencil size={16} />}>
            {editMode ? "Done editing" : "Edit who does what"}
          </ToolbarButton>
        </div>
      </div>

      {isShown(SECTION_KEYS.gold) && thisWeek && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Coins size={16} />} label="Raid gold this week" value={formatGold(thisWeek.raid_gold)} sub={`of ${formatGold(possibleGold)} possible`} />
          <Stat
            icon={<Coins size={16} />}
            label="Other gold this week"
            value={formatGold(thisWeek.other_gold)}
            sub={<Link href="/gold" className="underline">Log gold</Link>}
          />
          <Stat
            icon={<Wallet size={16} />}
            label="Total this week"
            value={formatGold(thisWeek.net)}
            sub={thisWeek.bonus_spent > 0 ? `after ${formatGold(thisWeek.bonus_spent)} on bonus boxes` : undefined}
            accent
          />
          <Stat
            icon={<Wallet size={16} />}
            label="Left to use"
            value={formatGold(thisWeek.tradeable_left)}
            sub={`tradeable · ${formatGold(thisWeek.roster_bound_left)} roster-bound`}
            title="After bonus boxes, which use character-bound gold first, then roster-bound, then tradeable"
          />
        </div>
      )}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {needsCheckIn && (
        <Notice onDismiss={() => setCheckInDismissed(tracker!.weekly_period)}>
          {lastCheckIn === null
            ? "Want to see gold you spend outside the tracker? Enter how much you have once a week."
            : "New week: check in how much gold you have to see what you spent on untracked things."}{" "}
          <Link href="/gold/#check-in" className="font-medium underline">Check in</Link>
        </Notice>
      )}

      {hasUnknownGold && (
        <Notice>
          Some raids your characters run don&apos;t have a gold value yet (shown as ?). Fill them in on the{" "}
          <Link href="/raids" className="font-medium underline">Raids page</Link>.
        </Notice>
      )}

      {customizing && (
        <CustomizePanel
          tasks={tasks.filter((t) => t.category !== "raid" || isActiveRaid(t))}
          hidden={hidden}
          onChange={setVisible}
          onReset={() => setHiddenRaw(DEFAULT_HIDDEN.join("|"))}
          onClose={() => setCustomizing(false)}
        />
      )}

      {editMode && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Choose each character&apos;s usual raids, difficulties and tasks. These count toward progress and possible
          gold. Raids a character can enter but doesn&apos;t usually run still show faded, so an extra clear can be
          ticked any week.
        </p>
      )}

      {characters.length === 0 && !error ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          No characters yet. <Link href="/settings" className="underline">Add your roster in Settings</Link>.
        </p>
      ) : (
        <>
          <TrackerCard
            icon={CalendarDays}
            title="This week"
            subtitle={tracker ? `Raids and weeklies · resets in ${formatCountdown(parseUtc(tracker.next_weekly_reset), now)}` : "Raids and weeklies"}
            done={week.done}
            total={week.total}
          >
            <TaskTable
              characters={week.rows}
              columns={week.columns}
              extraColumns={isShown(CHARACTER_BOUND_KEY) ? [characterBoundColumn] : []}
              renderCell={renderCell}
              columnNote={eventNote}
              onItemLevel={updateItemLevel}
              characterNote={goldRaidWarning}
            />
          </TrackerCard>

          {(showToday || showAnytime) && (
            <div className={`grid gap-4 ${showToday && showAnytime ? "lg:grid-cols-2" : ""}`}>
              {showToday && (
                <TrackerCard
                  icon={Sun}
                  title="Today"
                  subtitle={tracker ? `Dailies · resets in ${formatCountdown(parseUtc(tracker.next_daily_reset), now)}` : "Dailies"}
                  done={today.done}
                  total={today.total}
                  extra={
                    restedRunsAvailable > 0 ? (
                      <span className="flex items-center gap-1 font-medium text-accent">
                        <Flame size={14} /> {restedRunsAvailable} rested
                      </span>
                    ) : undefined
                  }
                >
                  <TaskTable characters={today.rows} columns={today.columns} renderCell={renderCell} onItemLevel={updateItemLevel} />
                </TrackerCard>
              )}
              {showAnytime && (
                <TrackerCard icon={Box} title="Any time" subtitle="Ebony Cube tickets · no reset, count runs this week">
                  <TaskTable characters={anytime.rows} columns={anytime.columns} renderCell={renderCell} onItemLevel={updateItemLevel} />
                </TrackerCard>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
        active ? "border-accent bg-accent/15 font-medium" : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Notice({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss until next week" className="rounded p-1 text-muted hover:bg-surface-2">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
  title,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3" title={title}>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
