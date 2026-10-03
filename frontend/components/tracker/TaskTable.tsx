import { ReactNode } from "react";

import ItemLevelEdit from "@/components/ItemLevelEdit";
import { Character, Task } from "@/lib/api";

export type ExtraColumn = {
  key: string;
  header: ReactNode;
  title?: string;
  cell: (character: Character) => ReactNode;
};

/** Characters down the side, tasks across: one card's grid. */
export default function TaskTable({
  characters,
  columns,
  extraColumns = [],
  renderCell,
  columnNote,
  onItemLevel,
  characterNote,
  characterAction,
  hideWhenEmpty = false,
}: {
  characters: Character[];
  columns: Task[];
  extraColumns?: ExtraColumn[];
  renderCell: (character: Character, task: Task) => ReactNode;
  columnNote?: (task: Task) => ReactNode;
  onItemLevel: (character: Character, itemLevel: number) => void;
  characterNote?: (character: Character) => ReactNode;
  /** A small button beside the name, e.g. "mark all done". */
  characterAction?: (character: Character) => ReactNode;
  /** Render nothing, rather than "Nothing to show", when there are no rows. */
  hideWhenEmpty?: boolean;
}) {
  if (characters.length === 0 && hideWhenEmpty) return null;
  if (characters.length === 0 || columns.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted">Nothing to show here.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="sticky left-0 z-10 min-w-40 bg-surface px-4 py-2 text-left font-medium">Character</th>
            {columns.map((task) => (
              <th key={task.id} className="min-w-28 px-2 py-2 text-center align-bottom font-medium">
                <div className="text-sm leading-tight text-foreground">{task.name}</div>
                {columnNote?.(task)}
              </th>
            ))}
            {extraColumns.map((column) => (
              <th key={column.key} title={column.title} className="whitespace-nowrap px-4 py-2 text-right align-bottom font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {characters.map((character) => (
            <tr key={character.id} className="border-b border-border last:border-b-0">
              <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{character.name}</span>
                  {character.is_gold_earner && (
                    <span title="Gold earner" className="rounded bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
                      GOLD
                    </span>
                  )}
                  {characterAction?.(character)}
                </div>
                <div className="text-xs text-muted">
                  {character.class_name} ·{" "}
                  <ItemLevelEdit
                    value={character.item_level}
                    characterName={character.name}
                    onSave={(value) => onItemLevel(character, value)}
                  />
                </div>
                {characterNote?.(character)}
              </td>
              {columns.map((task) => (
                <td key={task.id} className="p-0 text-center align-middle">
                  {renderCell(character, task)}
                </td>
              ))}
              {extraColumns.map((column) => (
                <td key={column.key} className="px-4 py-2 text-right tabular-nums">
                  {column.cell(character)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
