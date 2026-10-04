"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAccountChoice } from "@/components/AccountTabs";
import { RunChanges } from "@/components/ContentCell";
import { describeError } from "@/components/ErrorBanner";
import {
  Account,
  api,
  byPosition,
  Character,
  ExpectedBalances,
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
import { difficultyOf } from "@/lib/raids";
import { cellKey, isTiered } from "@/lib/trackerSections";

/**
 * Everything the tracker page reads from the API, and every change it makes.
 * Mutations update the screen right away where they can and re-read what the
 * server computes (gold, rest, runs) afterwards.
 */
export function useTrackerData() {
  const [allCharacters, setCharacters] = useState<Character[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tracker, setTracker] = useState<TrackerState | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [thisWeek, setThisWeek] = useState<WeeklyGold | null>(null);
  // Recent weeks for the widgets (oldest first, this week last).
  const [goldWeeks, setGoldWeeks] = useState<WeeklyGold[]>([]);
  const [gemWeeks, setGemWeeks] = useState<WeeklyGems[]>([]);
  // Tradeable + roster-bound gold on hand per the last check-in plus tracked gold since; null without one.
  const [balance, setBalance] = useState<number | null>(null);
  // undefined until loaded, null if there has never been a gold check-in.
  const [lastCheckIn, setLastCheckIn] = useState<string | null | undefined>(undefined);
  const [recap, setRecap] = useState<WeekRecap | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

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

  const nextDailyReset = tracker?.next_daily_reset;
  useEffect(() => {
    if (nextDailyReset && now >= parseUtc(nextDailyReset)) loadAll();
  }, [now, nextDailyReset, loadAll]);

  const restByCell = useMemo(
    () => new Map<string, RestState>((tracker?.rest ?? []).map((r) => [cellKey(r.character_id, r.task_id), r])),
    [tracker],
  );
  const runByCell = useMemo(
    () => new Map<string, Run>((tracker?.runs ?? []).map((r) => [cellKey(r.character_id, r.task_id), r])),
    [tracker],
  );
  const roster = useMemo(() => [...characters].sort(byPosition), [characters]);

  // ---------- mutations ----------

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
        const body =
          task.category === "raid" && isTiered(task) ? { difficulty_id: difficultyOf(character, task)?.id ?? null } : {};
        await send("PUT", `/characters/${character.id}/tasks/${task.id}/completion`, body);
      }
    } catch (e) {
      setError(describeError(e));
    }
    refreshTracker();
    loadWeeklyGold();
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

  return {
    allCharacters,
    characters,
    roster,
    accounts,
    accountId,
    setAccountId,
    tasks,
    tracker,
    runs: tracker?.runs ?? [],
    completed,
    restByCell,
    runByCell,
    thisWeek,
    goldWeeks,
    gemWeeks,
    balance,
    lastCheckIn,
    recap,
    now,
    error,
    setError,
    loadWeeklyGold,
    actions: {
      toggleCompletion,
      toggleRaid,
      setRaidDifficulty,
      chooseRaidDifficulty,
      updateRun,
      updateItemLevel,
      completeAll,
      setBonus,
      setRest,
      toggleAssignment,
    },
  };
}

export type TrackerData = ReturnType<typeof useTrackerData>;
