import ContentCell from "@/components/ContentCell";
import DifficultySelect from "@/components/DifficultySelect";
import EmberCounts from "@/components/EmberCounts";
import RaidCell from "@/components/RaidCell";
import LimitCounter from "@/components/LimitCounter";
import RestGauge from "@/components/RestGauge";
import RunsCheckbox from "@/components/RunsCheckbox";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { Character, Task } from "@/lib/api";
import { blessingActive, runsNeeded } from "@/lib/blessings";
import { dropsEmbers, EMBERS_PREFERENCE } from "@/lib/embers";
import { difficultyOf } from "@/lib/raids";
import { cellKey, isTiered } from "@/lib/trackerSections";
import { appliesTo } from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";

/**
 * One character's task in a tracker card: in edit mode, who does what; else a
 * raid (checkbox, difficulty, bonus box), tiered content (Ebony Cube,
 * Hourglass), or a plain checkbox with a rest gauge.
 */
export default function TrackerCell({
  character,
  task,
  data,
  editMode,
  compact,
}: {
  character: Character;
  task: Task;
  data: TrackerData;
  editMode: boolean;
  /** Usual raids show their difficulty as a label instead of a dropdown. */
  compact: boolean;
}) {
  const { actions } = data;
  const [emberLogging] = usePreference<boolean>(EMBERS_PREFERENCE, false);
  const key = cellKey(character.id, task.id);
  const isAssigned = character.task_ids.includes(task.id);
  const run = data.runByCell.get(key);
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
            onChange={(id) => actions.setRaidDifficulty(character, task, id)}
            noneLabel={task.counted ? "Doesn't do it" : "Doesn't run"}
            label={`${task.name} for ${character.name}`}
            highlight
          />
        </div>
      );
    }
    return (
      <label className="flex cursor-pointer items-center justify-center gap-1.5 py-3 text-xs">
        <input type="checkbox" checked={isAssigned} onChange={() => actions.toggleAssignment(character, task)} className="h-4 w-4" />
        {isAssigned ? "Does it" : "Doesn't"}
      </label>
    );
  }

  if (task.category === "raid" && isTiered(task)) {
    if (!appliesTo(character, task)) return dash;
    // Once per roster: only a clear on this character's own account blocks it.
    const otherClear = task.roster_limited
      ? data.runs.find(
          (r) =>
            r.task_id === task.id &&
            r.character_id !== character.id &&
            data.allCharacters.find((c) => c.id === r.character_id)?.account_id === character.account_id,
        )
      : undefined;
    return (
      <RaidCell
        task={task}
        character={character}
        isAssigned={isAssigned}
        run={run}
        clearedBy={otherClear ? data.allCharacters.find((c) => c.id === otherClear.character_id)?.name : undefined}
        onToggle={(done, difficultyId) => actions.toggleRaid(character, task, done, difficultyId)}
        onGate={(gate, difficultyId) => actions.toggleGate(character, task, gate, difficultyId)}
        onDifficulty={(difficultyId, done) => actions.chooseRaidDifficulty(character, task, difficultyId, done)}
        onBonus={(bought) => actions.setBonus(character, task, bought)}
        compact={compact}
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
        onChange={(changes) => actions.updateRun(character, task, changes)}
        onRemove={() => actions.updateRun(character, task, null)}
      />
    );
  }

  if (!isAssigned) return dash;
  const isDone = data.completed.has(key);
  const needed = runsNeeded(character, task, data.tracker?.daily_period);
  const rest = task.rest_max > 0 ? data.restByCell.get(key) : undefined;
  const embers = emberLogging && dropsEmbers(task);
  const day = data.tracker?.daily_period;
  return (
    <div className={`flex flex-col items-center gap-1.5 pt-2 ${isDone ? "bg-done/15" : ""} ${rest && !embers ? "" : "pb-2"}`}>
      {task.run_limit > 0 ? (
        <LimitCounter
          value={run?.count ?? 0}
          limit={task.run_limit}
          label={`${task.name} for ${character.name}`}
          onChange={(count) => actions.updateRun(character, task, count ? { count } : null)}
        />
      ) : needed > 1 ? (
        <RunsCheckbox
          runs={run?.count ?? 0}
          needed={needed}
          label={`${task.name} done by ${character.name}`}
          onClick={() => actions.toggleCompletion(character, task)}
        />
      ) : (
        <input
          type="checkbox"
          checked={isDone}
          onChange={() => actions.toggleCompletion(character, task)}
          aria-label={`${task.name} done by ${character.name}`}
          className="h-5 w-5 cursor-pointer"
        />
      )}
      {rest && (
        <RestGauge task={task} state={rest} characterName={character.name} onSet={(value) => actions.setRest(character, task, value)} />
      )}
      {embers && (
        <EmberCounts
          who={character.name}
          task={task.name}
          fate={run?.fate_embers ?? 0}
          blessed={run?.blessed_embers ?? 0}
          showBlessed={Boolean(day && blessingActive(character, "azena", day))}
          enabled={Boolean(run)}
          onChange={(changes) => actions.updateRun(character, task, changes)}
        />
      )}
    </div>
  );
}
