import { ReactNode } from "react";

import ItemLevelEdit from "@/components/ItemLevelEdit";
import { Character, Task } from "@/lib/api";
import { useMediaQuery } from "@/lib/useMediaQuery";

export type ExtraColumn = {
  key: string;
  header: ReactNode;
  title?: string;
  cell: (character: Character) => ReactNode;
};

/**
 * One card's grid: characters down the side, tasks across. On a phone or a
 * narrow window, each character becomes its own block with their tasks
 * stacked, so nothing needs sideways scrolling.
 */
export default function TaskTable({
  characters,
  columns,
  extraColumns = [],
  renderCell,
  columnNote,
  onItemLevel,
  characterNote,
  characterAction,
  applies,
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
  /** In the stacked layout, tasks that don't apply to a character are left out. */
  applies?: (character: Character, task: Task) => boolean;
  /** Render nothing, rather than "Nothing to show", when there are no rows. */
  hideWhenEmpty?: boolean;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  if (characters.length === 0 && hideWhenEmpty) return null;
  if (characters.length === 0 || columns.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted">Nothing to show here.</p>;
  }

  const who = (character: Character) => (
    <>
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
        <ItemLevelEdit value={character.item_level} characterName={character.name} onSave={(value) => onItemLevel(character, value)} />
      </div>
      {characterNote?.(character)}
    </>
  );

  if (!wide) {
    return (
      <ul className="divide-y divide-border">
        {characters.map((character) => (
          <li key={character.id} className="px-3 py-3">
            {who(character)}
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
              {columns
                .filter((task) => !applies || applies(character, task))
                .map((task) => (
                  <div key={task.id} className="overflow-hidden rounded-md border border-border text-center">
                    <div className="truncate px-2 pt-1.5 text-[11px] font-medium text-muted">
                      {task.name}
                      {columnNote?.(task)}
                    </div>
                    {renderCell(character, task)}
                  </div>
                ))}
            </div>
            {extraColumns.map((column) => (
              <div key={column.key} className="mt-2 flex items-center justify-between text-xs" title={column.title}>
                <span className="text-muted">{column.header}</span>
                <span className="tabular-nums">{column.cell(character)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    );
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
              <td className="sticky left-0 z-10 bg-surface px-4 py-2">{who(character)}</td>
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
