"use client";

import { Box, CalendarDays, Check, CheckCheck, Coins, Swords, Flame, Pencil, Settings2, Sun, Wallet, X } from "lucide-react";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import AccountTabs, { useAccountChoice } from "@/components/AccountTabs";
import ContentCell, { RunChanges } from "@/components/ContentCell";
import DifficultySelect from "@/components/DifficultySelect";
import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import QuickGold from "@/components/QuickGold";
import RaidCell from "@/components/RaidCell";
import RecapCard from "@/components/tracker/RecapCard";
import RestGauge from "@/components/RestGauge";
import CustomizePanel from "@/components/tracker/CustomizePanel";
import StyleChooser from "@/components/tracker/StyleChooser";
import TaskTable, { ExtraColumn } from "@/components/tracker/TaskTable";
import TrackerCard from "@/components/tracker/TrackerCard";
import NewsWidget from "@/components/tracker/NewsWidget";
import { GemWidget, GoldGoalWidget, GoldMonthWidget } from "@/components/tracker/Widgets";
import {
  Account,
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
  WeeklyGems,
  WeeklyGold,
  WeekRecap,
} from "@/lib/api";
import { missedGoldRaids } from "@/lib/recap";
import { daysIntoWeek } from "@/lib/insights";
import {
  difficultyOf,
  GOLD_RAIDS_PER_WEEK,
  goldRaidsLeft,
  goldRaidWeek,
  isActiveRaid,
  paidRaids,
  possibleRaidGold,
  raidGold,
} from "@/lib/raids";
import {
  appliesTo,
  CHARACTER_BOUND_KEY,
  countsForProgress,
  DEFAULT_HIDDEN_RAW,
  FINISHED_ROWS_KEY,
  HIDDEN_PREFERENCE,
  isFinished,
  parseHidden,
  RAID_PICKERS_KEY,
  remainingFor,
  Section,
  SECTION_KEYS,
  sectionOf,
  serializeHidden,
  STAT_KEYS,
  Style,
  styleHidden,
  viewKey,
  WIDGET_KEYS,
} from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";

const cellKey = (characterId: number, taskId: number) => `${characterId}:${taskId}`;

// Static class names so Tailwind generates them: the stat row fits however many boxes are shown.
const STAT_COLUMNS = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5"];

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
  const [allCharacters, setCharacters] = useState<Character[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tracker, setTracker] = useState<TrackerState | null>(null);
  const [thisWeek, setThisWeek] = useState<WeeklyGold | null>(null);
  // Recent weeks for the widgets (oldest first, this week last).
  const [goldWeeks, setGoldWeeks] = useState<WeeklyGold[]>([]);
  const [gemWeeks, setGemWeeks] = useState<WeeklyGems[]>([]);
  // Gold on hand per the last check-in plus tracked gold since; null without one.
  const [balance, setBalance] = useState<number | null>(null);
  const [goldGoal, setGoldGoal] = usePreference<number>("gold-goal", 1_000_000);
  // undefined until loaded, null if there has never been a gold check-in.
  const [lastCheckIn, setLastCheckIn] = useState<string | null | undefined>(undefined);
  const [checkInDismissed, setCheckInDismissed] = usePreference<string>("check-in-dismissed-week", "");
  const [recap, setRecap] = useState<WeekRecap | null>(null);
  const [recapDismissed, setRecapDismissed] = usePreference<string>("recap-dismissed-week", "");
  const [hiddenRaw, setHiddenRaw] = usePreference<string>(HIDDEN_PREFERENCE, DEFAULT_HIDDEN_RAW);
  // Whether the "how much do you want to track?" welcome has been answered.
  const [styleChosen, setStyleChosen] = usePreference<boolean>("style-chosen", false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const hidden = useMemo(() => parseHidden(hiddenRaw), [hiddenRaw]);
  const isShown = (key: string) => !hidden.has(key);
  // Which account's roster to show; 0 is all of them.
  const [accountId, setAccountId] = useAccountChoice(accounts);
  const accountQuery = accountId ? `account_id=${accountId}` : "";
  const characters = useMemo(
    () => (accountId ? allCharacters.filter((c) => c.account_id === accountId) : allCharacters),
    [allCharacters, accountId],
  );

  const loadWeeklyGold = useCallback(() => {
    // Nine weeks: this one, plus two runs of four finished weeks to compare.
    api<WeeklyGold[]>(`/gold/weekly?weeks=9&${accountQuery}`)
      .then((weeks) => {
        setGoldWeeks(weeks);
        setThisWeek(weeks[weeks.length - 1]);
      })
      .catch((e) => setError(describeError(e)));
    // Everything tracked so far counts toward the next big gem.
    api<WeeklyGems[]>(`/gems/weekly?weeks=104&${accountQuery}`)
      .then(setGemWeeks)
      .catch(() => {});
    api<WeekRecap>("/recap")
      .then(setRecap)
      .catch(() => {});
    api<ExpectedBalances | null>(`/balances/expected?${accountQuery}`)
      .then((data) => {
        setLastCheckIn(data ? data.last_check_in : null);
        // Character-bound gold can't go toward a shared goal.
        setBalance(data ? data.expected.tradeable + data.expected.roster_bound : null);
      })
      .catch(() => {});
  }, [accountQuery]);

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
      api<Account[]>("/accounts"),
    ])
      .then(([characterData, taskData, trackerData, accountData]) => {
        setCharacters(characterData);
        setAccounts(accountData);
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
  const namesById = new Map(allCharacters.map((c) => [c.id, c.name]));
  const accountOf = new Map(allCharacters.map((c) => [c.id, c.account_id]));
  const roster = [...characters].sort(byPosition);

  /** A card's columns and rows. Outside edit mode, only what applies to someone. */
  function sectionData(section: Section) {
    const columns = tasks
      .filter((t) => sectionOf(t) === section && isShown(viewKey(t)))
      .filter((t) => t.category !== "raid" || isActiveRaid(t))
      .filter((t) => editMode || roster.some((c) => appliesTo(c, t)))
      .sort(byPosition);
    const everyone = editMode ? roster : roster.filter((c) => columns.some((t) => appliesTo(c, t)));
    let done = 0;
    let total = 0;
    for (const character of everyone) {
      for (const task of columns) {
        if (!countsForProgress(character, task)) continue;
        total += 1;
        if (completed.has(cellKey(character.id, task.id))) done += 1;
      }
    }
    // Ebony Cube is run whenever there are tickets, so nobody is ever "done" with it.
    const tuckFinished = !editMode && section !== "anytime" && !isShown(FINISHED_ROWS_KEY);
    const finished = tuckFinished
      ? everyone.filter((c) => isFinished(c, columns, (t) => completed.has(cellKey(c.id, t.id))))
      : [];
    const rows = everyone.filter((c) => !finished.includes(c));
    return { columns, rows, done, total, finished };
  }

  const week = sectionData("week");
  const today = sectionData("today");
  const anytime = sectionData("anytime");
  const restedRunsAvailable = (tracker?.rest ?? []).filter(
    (r) => r.rested_run_available && today.columns.some((t) => t.id === r.task_id),
  ).length;

  const runs = tracker?.runs ?? [];
  const possibleGold = possibleRaidGold(characters, tasks, runs);
  const raidsLeft = goldRaidsLeft(characters, tasks, runs);
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
      loadWeeklyGold();
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


  /** Tick off everything a character still has to do in a card, in one click. */
  async function completeAll(character: Character, todo: Task[]) {
    try {
      for (const task of todo) {
        // Raids clear at the character's usual difficulty; everything else is a plain check.
        const body = task.category === "raid" && isTiered(task) ? { difficulty_id: difficultyOf(character, task)?.id ?? null } : {};
        await send("PUT", `/characters/${character.id}/tasks/${task.id}/completion`, body);
      }
    } catch (e) {
      setError(describeError(e));
    }
    refreshTracker();
    loadWeeklyGold();
  }

  /** The "all done" button beside a character's name, while they have something left. */
  function markAllButton(character: Character, columns: Task[], what: string) {
    if (editMode) return null;
    const todo = remainingFor(character, columns, (t) => completed.has(cellKey(character.id, t.id)));
    if (todo.length === 0) return null;
    const names = todo.map((t) => t.name).join(", ");
    return (
      <button
        onClick={() => completeAll(character, todo)}
        title={`Mark ${character.name}'s remaining ${what} done: ${names}`}
        aria-label={`Mark ${character.name}'s remaining ${what} done`}
        className="ml-auto flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-done/60 hover:text-done"
      >
        <CheckCheck size={12} /> All
      </button>
    );
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

  function applyStyle(style: Style) {
    setHiddenRaw(serializeHidden(styleHidden(style, tasks.filter((t) => t.category !== "raid" || isActiveRaid(t)))));
    setStyleChosen(true);
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
          <div className="flex justify-center px-1 py-3">
            <DifficultySelect
              task={task}
              character={character}
              value={isAssigned ? (difficulty?.id ?? null) : null}
              onChange={(id) => setRaidDifficulty(character, task, id)}
              noneLabel={task.counted ? "Doesn't do it" : "Doesn't run"}
              label={`${task.name} for ${character.name}`}
              highlight
            />
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
      // Once per roster: only a clear on this character's own account blocks it.
      const otherClear = task.roster_limited
        ? (tracker?.runs ?? []).find(
            (r) =>
              r.task_id === task.id &&
              r.character_id !== character.id &&
              accountOf.get(r.character_id) === character.account_id,
          )
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
          compact={!isShown(RAID_PICKERS_KEY)}
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

  const goldRaidNote = (character: Character) => {
    const { slots, left } = goldRaidWeek(character, tasks, runs);
    if (slots === 0) return null;
    const usual = paidRaids(character, tasks).length;
    const title =
      usual > GOLD_RAIDS_PER_WEEK
        ? `Runs ${usual} raids, but only the first ${GOLD_RAIDS_PER_WEEK} cleared each week pay gold`
        : `Only the first ${GOLD_RAIDS_PER_WEEK} raids cleared each week pay gold`;
    return left === 0 ? (
      <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-done" title={title}>
        <Check size={12} /> Gold raids done
      </div>
    ) : (
      <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-accent" title={title}>
        <Swords size={12} /> {left} gold raid{left === 1 ? "" : "s"} left
      </div>
    );
  };

  /** Who's tucked away for being done, with a way to show them again. */
  const finishedNote = (finished: Character[], everyoneDone: boolean, period: string) =>
    finished.length > 0 ? (
      <p className={`flex flex-wrap items-center gap-x-2 px-4 py-2.5 text-xs text-muted ${everyoneDone ? "" : "border-t border-border"}`}>
        <Check size={14} className="text-done" />
        <span>
          {everyoneDone ? `Everyone's done ${period}` : `${finished.map((c) => c.name).join(", ")} ${finished.length === 1 ? "is" : "are"} done ${period}`}
        </span>
        <button onClick={() => setVisible(FINISHED_ROWS_KEY, true)} className="underline hover:text-foreground">
          Show
        </button>
      </p>
    ) : null;

  const stats = thisWeek
    ? [
        {
          key: STAT_KEYS.raidsLeft,
          node: (
            <Stat
              icon={<Swords size={16} />}
              label="Gold raids left"
              value={String(raidsLeft.left)}
              sub={
                raidsLeft.slots === 0
                  ? "no gold earners with raids"
                  : `of ${raidsLeft.slots} this week${raidsLeft.events ? ` · +${raidsLeft.events} event` : ""}`
              }
              title="Each gold earner is paid for 3 raids a week; event raids pay once per account"
              accent={raidsLeft.left > 0}
            />
          ),
        },
        {
          key: STAT_KEYS.raidGold,
          node: <Stat icon={<Coins size={16} />} label="Raid gold this week" value={formatGold(thisWeek.raid_gold)} sub={`of ${formatGold(possibleGold)} possible`} />,
        },
        {
          key: STAT_KEYS.otherGold,
          node: (
            <Stat
              icon={<Coins size={16} />}
              label="Other gold this week"
              value={formatGold(thisWeek.other_gold)}
              sub={
                <span className="flex items-center gap-2">
                  <QuickGold
                    accountId={accountId || null}
                    onLogged={loadWeeklyGold}
                    onError={(e) => setError(describeError(e))}
                  />
                  <Link href="/gold" className="underline">Gold page</Link>
                </span>
              }
            />
          ),
        },
        {
          key: STAT_KEYS.total,
          node: (
            <Stat
              icon={<Wallet size={16} />}
              label="Total this week"
              value={formatGold(thisWeek.net)}
              sub={thisWeek.bonus_spent > 0 ? `after ${formatGold(thisWeek.bonus_spent)} on bonus boxes` : undefined}
              accent
            />
          ),
        },
        {
          key: STAT_KEYS.leftToUse,
          node: (
            <Stat
              icon={<Wallet size={16} />}
              label="Left to use"
              value={formatGold(thisWeek.tradeable_left)}
              sub={`tradeable · ${formatGold(thisWeek.roster_bound_left)} roster-bound`}
              title="After bonus boxes, which use character-bound gold first, then roster-bound, then tradeable"
            />
          ),
        },
      ].filter((stat) => isShown(stat.key))
    : [];

  const weekDays = tracker ? daysIntoWeek(tracker.weekly_period, now) : 0;
  const widgets = [
    { key: WIDGET_KEYS.goldMonth, node: <GoldMonthWidget weeks={goldWeeks} /> },
    {
      key: WIDGET_KEYS.goldGoal,
      node: <GoldGoalWidget weeks={goldWeeks} daysIntoWeek={weekDays} balance={balance} goal={goldGoal} onGoal={setGoldGoal} />,
    },
    { key: WIDGET_KEYS.gems, node: <GemWidget weeks={gemWeeks} daysIntoWeek={weekDays} /> },
    { key: WIDGET_KEYS.news, node: <NewsWidget /> },
  ].filter((widget) => isShown(widget.key) && goldWeeks.length > 0);

  const showToday = isShown(SECTION_KEYS.today) && (today.columns.length > 0 || editMode);
  const showAnytime = isShown(SECTION_KEYS.anytime) && (anytime.columns.length > 0 || editMode);
  // Last week's recap: through the weekend after the reset, until dismissed, if
  // anything happened last week.
  const lastGoldWeek = goldWeeks.at(-2);
  const lastGemWeek = gemWeeks.at(-2);
  const missed = recap ? missedGoldRaids(characters, tasks, recap.paid_raids) : [];
  const showRecap =
    tracker &&
    recap &&
    isShown(SECTION_KEYS.recap) &&
    recapDismissed !== tracker.weekly_period &&
    daysIntoWeek(tracker.weekly_period, now) < 5 &&
    ((lastGoldWeek?.total ?? 0) > 0 || (lastGemWeek?.total ?? 0) > 0 || Object.keys(recap.paid_raids).length > 0);

  // Check-ins are about spending, so they follow the "Left to use" box.
  const needsCheckIn =
    tracker &&
    isShown(STAT_KEYS.leftToUse) &&
    lastCheckIn !== undefined &&
    checkInDismissed !== tracker.weekly_period &&
    (lastCheckIn === null || parseUtc(lastCheckIn) < parseUtc(`${tracker.weekly_period}T10:00:00`));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Roster</h1>
          <AccountTabs accounts={accounts} value={accountId} onChange={setAccountId} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolbarButton active={customizing} onClick={() => setCustomizing((v) => !v)} icon={<Settings2 size={16} />}>
            Customize
          </ToolbarButton>
          <ToolbarButton active={editMode} onClick={() => setEditMode((v) => !v)} icon={<Pencil size={16} />}>
            {editMode ? "Done editing" : "Edit who does what"}
          </ToolbarButton>
        </div>
      </div>

      {allCharacters.length > 0 && !styleChosen && (
        <section className="rounded-lg border border-accent/40 bg-surface p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">How much do you want to track?</h2>
              <p className="text-xs text-muted">Pick a starting point. You can fine-tune anything later under Customize.</p>
            </div>
            <button onClick={() => setStyleChosen(true)} className="shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2">
              Keep as is
            </button>
          </div>
          <StyleChooser current={null} onChoose={applyStyle} />
        </section>
      )}

      {stats.length > 0 && (
        <div className={`grid gap-3 sm:grid-cols-2 ${STAT_COLUMNS[stats.length]}`}>
          {stats.map((stat) => (
            <div key={stat.key}>{stat.node}</div>
          ))}
        </div>
      )}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {showRecap && (
        <RecapCard
          week={recap!.week}
          gold={lastGoldWeek}
          previousGold={goldWeeks.at(-3)}
          gems={lastGemWeek}
          missed={missed}
          onDismiss={() => setRecapDismissed(tracker!.weekly_period)}
        />
      )}

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
          onStyle={applyStyle}
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
          {allCharacters.length > 0 ? "No characters on this account yet." : "No characters yet."}{" "}
          <Link href="/settings" className="underline">Add your roster in Settings</Link>.
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
              applies={editMode ? undefined : appliesTo}
              characters={week.rows}
              columns={week.columns}
              extraColumns={isShown(CHARACTER_BOUND_KEY) ? [characterBoundColumn] : []}
              renderCell={renderCell}
              columnNote={eventNote}
              onItemLevel={updateItemLevel}
              characterNote={goldRaidNote}
              characterAction={(c) => markAllButton(c, week.columns, "raids and weeklies")}
              hideWhenEmpty={week.finished.length > 0}
            />
            {finishedNote(week.finished, week.rows.length === 0, "this week")}
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
                  <TaskTable
                    applies={editMode ? undefined : appliesTo}
                    characters={today.rows}
                    columns={today.columns}
                    renderCell={renderCell}
                    onItemLevel={updateItemLevel}
                    hideWhenEmpty={today.finished.length > 0}
                    characterAction={(c) => markAllButton(c, today.columns, "dailies")}
                  />
                  {finishedNote(today.finished, today.rows.length === 0, "today")}
                </TrackerCard>
              )}
              {showAnytime && (
                <TrackerCard icon={Box} title="Any time" subtitle="Ebony Cube tickets · no reset, count runs this week">
                  <TaskTable
                    applies={editMode ? undefined : appliesTo}
                    characters={anytime.rows}
                    columns={anytime.columns}
                    renderCell={renderCell}
                    onItemLevel={updateItemLevel}
                  />
                </TrackerCard>
              )}
            </div>
          )}

          {widgets.length > 0 && (
            <div className={`grid gap-4 md:grid-cols-2 ${widgets.length === 3 ? "xl:grid-cols-3" : ""}`}>
              {widgets.map((widget) => (
                <div key={widget.key} className="flex [&>*]:flex-1">
                  {widget.node}
                </div>
              ))}
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
    <div className="h-full rounded-lg border border-border bg-surface px-4 py-3" title={title}>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
