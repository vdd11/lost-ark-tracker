import { KeyboardEvent, ReactNode, useRef, useState } from "react";

import ItemLevelEdit from "@/components/ItemLevelEdit";
import { CellKeyboard } from "@/components/tracker/cellKeys";
import { Character, Task } from "@/lib/api";
import { GridPosition, moveFocus } from "@/lib/shortcuts";
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
 *
 * With `cellKeyboard`, every cell is a labeled, focusable box: the card is one
 * Tab stop, arrows / Home / End move between cells, Space or Enter toggles,
 * + and − change run counters, and `a` runs `onRowAll` for that character.
 * Keys only act on the box itself, so the controls inside keep working as usual.
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
  cellKeyboard,
  onRowAll,
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
  cellKeyboard?: (character: Character, task: Task) => CellKeyboard;
  /** The `a` key: mark the character's remaining tasks in this card done. */
  onRowAll?: (character: Character) => void;
  /** Render nothing, rather than "Nothing to show", when there are no rows. */
  hideWhenEmpty?: boolean;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  // The cell that holds the card's one Tab stop (roving tabindex).
  const [focus, setFocus] = useState<GridPosition>({ row: 0, col: 0 });
  const boxes = useRef(new Map<string, HTMLElement>());
  if (characters.length === 0 && hideWhenEmpty) return null;
  if (characters.length === 0 || columns.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted">Nothing to show here.</p>;
  }

  // The cells in each row, as laid out (the stacked layout leaves out what doesn't apply).
  const rowTasks = characters.map((c) => (wide || !applies ? columns : columns.filter((t) => applies(c, t))));
  const activeRow = Math.min(focus.row, characters.length - 1);
  const active = { row: activeRow, col: Math.min(focus.col, Math.max(0, rowTasks[activeRow].length - 1)) };

  function focusCell(row: number, col: number) {
    const target = { row, col: Math.min(col, Math.max(0, rowTasks[row].length - 1)) };
    setFocus(target);
    boxes.current.get(`${target.row}:${target.col}`)?.focus();
  }

  function handleKey(event: KeyboardEvent<HTMLElement>, row: number, col: number, keys: CellKeyboard, character: Character) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const moved = moveFocus({ row, col }, event.key, characters.length, rowTasks[row].length);
    const act = (run?: () => void) => {
      event.preventDefault();
      run?.();
    };
    if (moved) act(() => focusCell(moved.row, moved.col));
    else if (event.key === " " || event.key === "Enter") act(keys.toggle);
    else if (event.key === "+" || event.key === "=") act(keys.increment);
    else if (event.key === "-" || event.key === "_") act(keys.decrement);
    else if ((event.key === "a" || event.key === "A") && onRowAll) act(() => onRowAll(character));
  }

  /** A cell's content, in a focusable box when the card takes keyboard input. */
  const cell = (character: Character, task: Task, row: number, col: number) => {
    if (!cellKeyboard) return renderCell(character, task);
    const keys = cellKeyboard(character, task);
    const id = `${row}:${col}`;
    return (
      <div
        ref={(element) => {
          if (element) boxes.current.set(id, element);
          else boxes.current.delete(id);
        }}
        role="group"
        aria-label={keys.label}
        tabIndex={active.row === row && active.col === col ? 0 : -1}
        onFocus={() => setFocus({ row, col })}
        onKeyDown={(event) => handleKey(event, row, col, keys, character)}
        className="h-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        {renderCell(character, task)}
      </div>
    );
  };

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
        {characters.map((character, row) => (
          <li key={character.id} className="px-3 py-3">
            {who(character)}
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
              {rowTasks[row].map((task, col) => (
                <div key={task.id} className="overflow-hidden rounded-md border border-border text-center">
                  <div className="truncate px-2 pt-1.5 text-[11px] font-medium text-muted">
                    {task.name}
                    {columnNote?.(task)}
                  </div>
                  {cell(character, task, row, col)}
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
          {characters.map((character, row) => (
            <tr key={character.id} className="border-b border-border last:border-b-0">
              <td className="sticky left-0 z-10 bg-surface px-4 py-2">{who(character)}</td>
              {columns.map((task, col) => (
                <td key={task.id} className="p-0 text-center align-middle">
                  {cell(character, task, row, col)}
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
