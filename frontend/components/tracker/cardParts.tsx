import { Check, CheckCheck, Swords } from "lucide-react";

import { ExtraColumn } from "@/components/tracker/TaskTable";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { Character, formatGold, Task, WeeklyGold } from "@/lib/api";
import { GOLD_RAIDS_PER_WEEK, goldRaidWeek, paidRaids } from "@/lib/raids";
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
      className="ml-auto flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-done/60 hover:text-done"
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
    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-done" title={title}>
      <Check size={12} /> Gold raids done
    </div>
  ) : (
    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-accent" title={title}>
      <Swords size={12} /> {left} gold raid{left === 1 ? "" : "s"} left
    </div>
  );
}

/** Under an event raid's column header: when it ends. */
export function eventNote(task: Task) {
  return task.ends_on ? (
    <div className="text-[11px] font-normal text-muted">
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
          {gold.spent > 0 && <span className="block text-[11px] text-muted">of {formatGold(gold.earned)}</span>}
        </span>
      );
    },
  };
}
