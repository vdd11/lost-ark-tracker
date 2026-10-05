import { Check, CheckCheck, Hammer, Swords, TrendingUp } from "lucide-react";
import Link from "next/link";

import { ExtraColumn } from "@/components/tracker/TaskTable";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { Character, formatGold, Task, WeeklyGold } from "@/lib/api";
import { goalProgress, HoningGoal } from "@/lib/honing";
import { formatGap, nextUnlock } from "@/lib/itemLevelGoals";
import { formatItemLevel, GOLD_RAIDS_PER_WEEK, goldRaidWeek, paidRaids } from "@/lib/raids";
import { cellKey } from "@/lib/trackerSections";
import { remainingFor } from "@/lib/trackerView";

/** The "All" button beside a character's name, while they have something left in the card. */
export function MarkAllButton({
  character,
  columns,
  what,
  data,
}: {
  character: Character;
  columns: Task[];
  what: string;
  data: TrackerData;
}) {
  const todo = remainingFor(character, columns, (t) => data.completed.has(cellKey(character.id, t.id)));
  if (todo.length === 0) return null;
  const names = todo.map((t) => t.name).join(", ");
  return (
    <button
      onClick={() => data.actions.completeAll(character, todo)}
      title={`Mark ${character.name}'s remaining ${what} done: ${names}`}
      aria-label={`Mark ${character.name}'s remaining ${what} done`}
      className="ml-auto flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted hover:border-done/60 hover:text-done"
    >
      <CheckCheck size={12} /> All
    </button>
  );
}

/** Who's tucked away for being done, with a way to show them again. */
export function FinishedNote({
  finished,
  everyoneDone,
  period,
  onShow,
}: {
  finished: Character[];
  everyoneDone: boolean;
  period: string;
  onShow: () => void;
}) {
  if (finished.length === 0) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 px-4 py-2.5 text-xs text-muted ${everyoneDone ? "" : "border-t border-border"}`}>
      <Check size={14} className="text-done" />
      <span>
        {everyoneDone
          ? `Everyone's done ${period}`
          : `${finished.map((c) => c.name).join(", ")} ${finished.length === 1 ? "is" : "are"} done ${period}`}
      </span>
      <button onClick={onShow} className="underline hover:text-foreground">
        Show
      </button>
    </p>
  );
}

/** "2 gold raids left" / "Gold raids done" under a gold earner's name. */
export function GoldRaidNote({ character, data }: { character: Character; data: TrackerData }) {
  const { slots, left } = goldRaidWeek(character, data.tasks, data.runs);
  if (slots === 0) return null;
  const usual = paidRaids(character, data.tasks).length;
  const title =
    usual > GOLD_RAIDS_PER_WEEK
      ? `Runs ${usual} raids, but only the first ${GOLD_RAIDS_PER_WEEK} cleared each week pay gold`
      : `Only the first ${GOLD_RAIDS_PER_WEEK} raids cleared each week pay gold`;
  return left === 0 ? (
    <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-done" title={title}>
      <Check size={12} /> Gold raids done
    </div>
  ) : (
    <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-accent" title={title}>
      <Swords size={12} /> {left} gold raid{left === 1 ? "" : "s"} left
    </div>
  );
}

/** "Next: The Final Day Hard at 1730 (+5)": what the character's next upgrade unlocks. */
export function NextUnlockNote({ character, tasks }: { character: Character; tasks: Task[] }) {
  const next = nextUnlock(character, tasks);
  if (!next) return null;
  const { task, difficulty, gap } = next;
  const pays = difficulty.gold ? ` It pays ${formatGold(difficulty.gold)} gold.` : "";
  return (
    <div
      className="mt-0.5 flex items-center gap-1 text-xs text-muted"
      title={`${task.name} ${difficulty.name} needs item level ${formatItemLevel(difficulty.min_item_level)}.${pays}`}
    >
      <TrendingUp size={12} />
      Next: {task.name} {difficulty.name} at {formatItemLevel(difficulty.min_item_level)} ({formatGap(gap)})
    </div>
  );
}

/** "Plan: 1720 ▬▬": progress toward the character's honing plan, if it has a target. */
export function HoningGoalNote({ character, goals }: { character: Character; goals: HoningGoal[] }) {
  const goal = goals.find((g) => g.character_id === character.id);
  const progress = goal ? goalProgress(character.item_level, goal) : null;
  if (!goal || progress === null || goal.target_item_level == null) return null;
  return (
    <Link
      href="/tools/honing"
      className="mt-0.5 flex items-center gap-1 text-xs text-muted hover:text-accent"
      title={`Honing plan: ${formatItemLevel(goal.start_item_level)} → ${formatItemLevel(goal.target_item_level)}`}
    >
      <Hammer size={12} />
      Plan: {formatItemLevel(goal.target_item_level)}
      {progress >= 1 ? (
        <span className="text-done">reached</span>
      ) : (
        <span className="ml-0.5 inline-block h-1 w-10 overflow-hidden rounded bg-surface-2" aria-label={`${Math.round(progress * 100)}% of the way`}>
          <span className="block h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
    </Link>
  );
}

/** Under an event raid's column header: when it ends. */
export function eventNote(task: Task) {
  return task.ends_on ? (
    <div className="text-xs font-normal text-muted">
      event · until {new Date(`${task.ends_on}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
    </div>
  ) : null;
}

/** Each character's character-bound gold left this week. */
export function characterBoundColumn(thisWeek: WeeklyGold | null): ExtraColumn {
  return {
    key: "character-bound",
    header: "Char-bound gold",
    title: "Character-bound gold left this week, after bonus boxes bought on that character",
    cell: (character) => {
      const gold = thisWeek?.character_bound[String(character.id)];
      if (!gold) return <span className="text-muted/40">–</span>;
      return (
        <span title={`Earned ${formatGold(gold.earned)}, ${formatGold(gold.spent)} spent on bonus boxes`}>
          <span className="block">{formatGold(gold.left)}</span>
          {gold.spent > 0 && <span className="block text-xs text-muted">of {formatGold(gold.earned)}</span>}
        </span>
      );
    },
  };
}
