import { CalendarDays } from "lucide-react";

import {
  characterBoundColumn,
  eventNote,
  FinishedNote,
  GoldRaidNote,
  MarkAllButton,
  HoningGoalNote,
  NextUnlockNote,
} from "@/components/tracker/cardParts";
import { cellKeyboard } from "@/components/tracker/cellKeys";
import TaskTable from "@/components/tracker/TaskTable";
import TrackerCard from "@/components/tracker/TrackerCard";
import TrackerCell from "@/components/tracker/TrackerCell";
import BoundGoldNote from "@/components/tracker/BoundGoldNote";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { parseUtc } from "@/lib/api";
import { cellKey, formatCountdown, SectionData } from "@/lib/trackerSections";
import { appliesTo, CHARACTER_BOUND_KEY, FINISHED_ROWS_KEY, RAID_PICKERS_KEY, remainingFor } from "@/lib/trackerView";

/** Raids and weeklies, reset Wednesday. */
export default function WeekCard({
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
  return (
    <TrackerCard
      icon={CalendarDays}
      title="This week"
      subtitle={
        tracker
          ? `Raids and weeklies · resets in ${formatCountdown(parseUtc(tracker.next_weekly_reset), now)}`
          : "Raids and weeklies"
      }
      done={section.done}
      total={section.total}
    >
      <TaskTable
        applies={editMode ? undefined : appliesTo}
        characters={section.rows}
        columns={section.columns}
        extraColumns={view.isShown(CHARACTER_BOUND_KEY) ? [characterBoundColumn(data.thisWeek)] : []}
        renderCell={(character, task) => (
          <TrackerCell character={character} task={task} data={data} editMode={editMode} compact={!view.isShown(RAID_PICKERS_KEY)} />
        )}
        columnNote={eventNote}
        onItemLevel={data.actions.updateItemLevel}
        onGoldEarner={data.actions.setGoldEarner}
        cellKeyboard={(character, task) => cellKeyboard(character, task, data, editMode)}
        onRowAll={
          editMode
            ? undefined
            : (character) => {
                const todo = remainingFor(character, section.columns, (t) => data.completed.has(cellKey(character.id, t.id)));
                if (todo.length > 0) data.actions.completeAll(character, todo);
              }
        }
        characterNote={(character) => <GoldRaidNote character={character} data={data} />}
        characterGoal={(character) => (
          <>
            <NextUnlockNote character={character} tasks={data.tasks} />
            <HoningGoalNote character={character} goals={data.honingGoals} />
            <BoundGoldNote character={character} data={data} />
          </>
        )}
        characterAction={
          editMode
            ? undefined
            : (character) => <MarkAllButton character={character} columns={section.columns} what="raids and weeklies" data={data} />
        }
        hideWhenEmpty={section.finished.length > 0}
      />
      <FinishedNote
        finished={section.finished}
        everyoneDone={section.rows.length === 0}
        period="this week"
        onShow={() => view.setVisible(FINISHED_ROWS_KEY, true)}
      />
    </TrackerCard>
  );
}
