import { Flame, Sun } from "lucide-react";

import { FinishedNote, MarkAllButton } from "@/components/tracker/cardParts";
import { cellKeyboard } from "@/components/tracker/cellKeys";
import TaskTable from "@/components/tracker/TaskTable";
import TrackerCard from "@/components/tracker/TrackerCard";
import TrackerCell from "@/components/tracker/TrackerCell";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { parseUtc } from "@/lib/api";
import { cellKey, formatCountdown, SectionData } from "@/lib/trackerSections";
import { appliesTo, FINISHED_ROWS_KEY, RAID_PICKERS_KEY, remainingFor } from "@/lib/trackerView";
import GameIcon from "@/components/GameIcon";

/** Dailies, reset every day, with how many rested runs are waiting. */
export default function TodayCard({
  section,
  data,
  view,
  editMode,
}: {
  section: SectionData;
  data: TrackerData;
  view: TrackerView;
  editMode: boolean;
}) {
  const { tracker, now } = data;
  const restedRuns = (tracker?.rest ?? []).filter(
    (r) => r.rested_run_available && section.columns.some((t) => t.id === r.task_id),
  ).length;

  return (
    <TrackerCard
      icon={Sun}
      title="Today"
      subtitle={tracker ? `Dailies · resets in ${formatCountdown(parseUtc(tracker.next_daily_reset), now)}` : "Dailies"}
      done={section.done}
      total={section.total}
      extra={
        restedRuns > 0 ? (
          <span className="flex items-center gap-1 font-medium text-accent">
            <GameIcon name="rest" size={14} fallback={Flame} alt="" /> {restedRuns} rested
          </span>
        ) : undefined
      }
    >
      <TaskTable
        applies={editMode ? undefined : appliesTo}
        characters={section.rows}
        columns={section.columns}
        renderCell={(character, task) => (
          <TrackerCell character={character} task={task} data={data} editMode={editMode} compact={!view.isShown(RAID_PICKERS_KEY)} />
        )}
        onItemLevel={data.actions.updateItemLevel}
        raids={data.tasks}
        cellKeyboard={(character, task) => cellKeyboard(character, task, data, editMode)}
        onRowAll={
          editMode
            ? undefined
            : (character) => {
                const todo = remainingFor(character, section.columns, (t) => data.completed.has(cellKey(character.id, t.id)));
                if (todo.length > 0) data.actions.completeAll(character, todo);
              }
        }
        hideWhenEmpty={section.finished.length > 0}
        characterAction={
          editMode
            ? undefined
            : (character) => <MarkAllButton character={character} columns={section.columns} what="dailies" data={data} />
        }
      />
      <FinishedNote
        finished={section.finished}
        everyoneDone={section.rows.length === 0}
        period="today"
        onShow={() => view.setVisible(FINISHED_ROWS_KEY, true)}
      />
    </TrackerCard>
  );
}
