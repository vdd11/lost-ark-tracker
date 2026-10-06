"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAccountChoice } from "@/components/AccountTabs";
import { RunChanges } from "@/components/ContentCell";
import { describeError } from "@/components/ErrorBanner";
import { useUndo } from "@/components/Toast";
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
import { dailyRunsNeeded, fullyDone } from "@/lib/blessings";
import { OnHand } from "@/lib/goldGoal";
import { difficultyOf } from "@/lib/raids";
import { cellKey, isTiered } from "@/lib/trackerSections";
import { restoreRunBody } from "@/lib/undo";

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
  // Every completion this period; `completed` below leaves out a daily with a run still to go.
  const [rawCompleted, setCompleted] = useState<Set<string>>(new Set());
  const [thisWeek, setThisWeek] = useState<WeeklyGold | null>(null);
  // Recent weeks for the widgets (oldest first, this week last).
  const [goldWeeks, setGoldWeeks] = useState<WeeklyGold[]>([]);
  const [gemWeeks, setGemWeeks] = useState<WeeklyGems[]>([]);
  // Tradeable + roster-bound gold on hand per the last check-in plus tracked gold since; null without one.
  const [balance, setBalance] = useState<number | null>(null);
  const [onHand, setOnHand] = useState<OnHand | null>(null);
  const [boundGold, setBoundGold] = useState<Record<string, number | null>>({});
  // undefined until loaded, null if there has never been a gold check-in.
  const [lastCheckIn, setLastCheckIn] = useState<string | null | undefined>(undefined);
  const [recap, setRecap] = useState<WeekRecap | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const offerUndo = useUndo();

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
    api<WeeklyGems[]>(`/gems/weekly?weeks=520&${accountQuery}`)
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
        setOnHand(data ? { tradeable: data.expected.tradeable, roster_bound: data.expected.roster_bound } : null);
      })
      .catch(() => {});
    api<Record<string, number | null>>("/bound-gold")
      .then(setBoundGold)
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
        setLoaded(true);
      })
      .catch((e) => {
        setError(describeError(e));
        setLoaded(true);
      });
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
  const day = tracker?.daily_period;
  const completed = useMemo(
    () => fullyDone(rawCompleted, tracker?.runs ?? [], characters, tasks, day),
    [rawCompleted, tracker, characters, tasks, day],
  );

  // ---------- mutations ----------

  const completionPath = (character: Character, task: Task) => `/characters/${character.id}/tasks/${task.id}/completion`;

  /** Offer to take back a change; `inverse` makes the API calls, then the tracker re-reads. */
  function undoable(message: string, inverse: () => Promise<unknown>) {
    offerUndo(message, async () => {
      await inverse();
      refreshTracker();
      loadWeeklyGold();
    });
  }

  /** Undo for a tick (remove it again) or an untick (put the run back as it was). */
  function offerToggleUndo(character: Character, task: Task, ticked: boolean, before: Run | undefined) {
    const path = completionPath(character, task);
    if (ticked) undoable(`${task.name} done on ${character.name}`, () => send("DELETE", path));
    else undoable(`${task.name} unticked on ${character.name}`, () => send("PUT", path, before ? restoreRunBody(before) : {}));
  }

  async function toggleCompletion(character: Character, task: Task) {
    const key = cellKey(character.id, task.id);
    const needed = dailyRunsNeeded(character, task, day);
    if (needed > 1) return stepRuns(character, task, needed);
    const wasDone = rawCompleted.has(key);
    const update = (done: boolean) =>
      setCompleted((prev) => {
        const next = new Set(prev);
        if (done) next.add(key);
        else next.delete(key);
        return next;
      });

    update(!wasDone);
    try {
      await send(wasDone ? "DELETE" : "PUT", completionPath(character, task));
      loadWeeklyGold();
      if (task.rest_max > 0) refreshTracker();
      offerToggleUndo(character, task, !wasDone, undefined);
    } catch (e) {
      update(wasDone);
      setError(describeError(e));
    }
  }

  /**
   * A daily with more than one run today (Chaos Dungeon with Innana's): each
   * click is one run, so the box fills halfway, then all the way; a click
   * on a full box clears it.
   */
  async function stepRuns(character: Character, task: Task, needed: number) {
    const path = completionPath(character, task);
    const before = rawCompleted.has(cellKey(character.id, task.id)) ? (runByCell.get(cellKey(character.id, task.id))?.count ?? 1) : 0;
    const after = before >= needed ? 0 : before + 1;
    try {
      await (after === 0 ? send("DELETE", path) : send("PUT", path, { count: after }));
      refreshTracker();
      loadWeeklyGold();
      undoable(
        after === 0 ? `${task.name} unticked on ${character.name}` : `${task.name} run ${after} of ${needed} on ${character.name}`,
        () => (before === 0 ? send("DELETE", path) : send("PUT", path, { count: before })),
      );
    } catch (e) {
      setError(describeError(e));
    }
  }

  /** Check off (or un-check) a raid at a difficulty; works for extra raids too. */
  async function toggleRaid(
    character: Character,
    task: Task,
    done: boolean,
    difficultyId: number | undefined,
    offer = true,
  ) {
    const before = runByCell.get(cellKey(character.id, task.id));
    try {
      const path = completionPath(character, task);
      await (done ? send("PUT", path, { difficulty_id: difficultyId ?? null }) : send("DELETE", path));
      loadWeeklyGold();
      refreshTracker();
      if (offer) offerToggleUndo(character, task, done, before);
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
    // Changing the difficulty of a clear isn't a tick, so no undo offer.
    if (done) await toggleRaid(character, task, true, difficultyId, false);
  }

  /** Update this period's run of tiered content: runs, sands, lucky rooms. */
  async function updateRun(character: Character, task: Task, changes: RunChanges | null) {
    const before = runByCell.get(cellKey(character.id, task.id));
    try {
      const path = completionPath(character, task);
      await (changes === null ? send("DELETE", path) : send("PUT", path, changes));
      refreshTracker();
      loadWeeklyGold();
      // Ticking or unticking (an empty change, or removing the run) can be undone;
      // counts, sands and lucky rooms are reversed with their own +/-.
      if (changes === null) offerToggleUndo(character, task, false, before);
      else if (Object.keys(changes).length === 0 && !before) offerToggleUndo(character, task, true, undefined);
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

  /** What a character has in character-bound gold now, as the game shows it. */
  async function setBoundGoldFor(character: Character, amount: number) {
    try {
      await send("PUT", `/characters/${character.id}/bound-gold`, { amount });
      loadWeeklyGold();
    } catch (e) {
      setError(describeError(e));
    }
  }

  /** Make a character a gold earner or not (6 per account; the API refuses a 7th). */
  async function setGoldEarner(character: Character, isGoldEarner: boolean) {
    try {
      await send("PATCH", `/characters/${character.id}`, { is_gold_earner: isGoldEarner });
      loadAll();
    } catch (e) {
      setError(describeError(e));
    }
  }

  /** Tick off everything a character still has to do in a card, in one click. */
  async function completeAll(character: Character, todo: Task[]) {
    const ticked: Task[] = [];
    try {
      for (const task of todo) {
        // Raids clear at the usual difficulty; a daily with two runs today (Innana's) gets both.
        const runsNeeded = dailyRunsNeeded(character, task, day);
        const body =
          task.category === "raid" && isTiered(task)
            ? { difficulty_id: difficultyOf(character, task)?.id ?? null }
            : runsNeeded > 1
              ? { count: runsNeeded }
              : {};
        await send("PUT", completionPath(character, task), body);
        ticked.push(task);
      }
    } catch (e) {
      setError(describeError(e));
    }
    refreshTracker();
    loadWeeklyGold();
    if (ticked.length > 0) {
      undoable(`Marked ${ticked.length} of ${character.name}'s tasks done`, async () => {
        for (const task of ticked) await send("DELETE", completionPath(character, task));
      });
    }
  }

  async function setBonus(character: Character, task: Task, bought: boolean) {
    try {
      const path = completionPath(character, task);
      await send("PUT", path, { bought_bonus: bought });
      loadWeeklyGold();
      refreshTracker();
      undoable(`${bought ? "Bought" : "Removed"} the ${task.name} bonus box on ${character.name}`, () =>
        send("PUT", path, { bought_bonus: !bought }),
      );
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
    onHand,
    boundGold,
    now,
    error,
    loaded,
    setError,
    loadWeeklyGold,
    refreshTracker,
    /** Reload characters, tasks and the tracker (after adding characters elsewhere). */
    reload: loadAll,
    actions: {
      toggleCompletion,
      toggleRaid,
      setRaidDifficulty,
      chooseRaidDifficulty,
      updateRun,
      updateItemLevel,
      setGoldEarner,
      setBoundGold: setBoundGoldFor,
      completeAll,
      setBonus,
      setRest,
      toggleAssignment,
    },
  };
}

export type TrackerData = ReturnType<typeof useTrackerData>;
