
import { cellKeyboard } from "@/components/tracker/cellKeys";
import TaskTable from "@/components/tracker/TaskTable";
import TrackerCard from "@/components/tracker/TrackerCard";
import TrackerCell from "@/components/tracker/TrackerCell";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { SectionData } from "@/lib/trackerSections";
import { appliesTo, RAID_PICKERS_KEY } from "@/lib/trackerView";

/** Ebony Cube: run whenever there are tickets, so it's counted rather than checked. */
export default function AnytimeCard({
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
  return (
    <TrackerCard icon="ebony-cube" title="Ebony Cube" subtitle="Tickets, no reset · count runs this week">
      <TaskTable
        applies={editMode ? undefined : appliesTo}
        characters={section.rows}
        columns={section.columns}
        renderCell={(character, task) => (
          <TrackerCell character={character} task={task} data={data} editMode={editMode} compact={!view.isShown(RAID_PICKERS_KEY)} />
        )}
        onItemLevel={data.actions.updateItemLevel}
        cellKeyboard={(character, task) => cellKeyboard(character, task, data, editMode)}
      />
    </TrackerCard>
  );
}
