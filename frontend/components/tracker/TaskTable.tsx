import { KeyboardEvent, ReactNode, useRef, useState } from "react";

import ItemLevelEdit from "@/components/ItemLevelEdit";
import { CellKeyboard } from "@/components/tracker/cellKeys";
import { Character, Task } from "@/lib/api";
import { GridPosition, isTypingTarget, moveFocus } from "@/lib/shortcuts";
import { useMediaQuery } from "@/lib/useMediaQuery";
import GameIcon from "@/components/GameIcon";
import { classIconName, taskIconName } from "@/lib/data/icons";
import { bestRaidTier, tierHint, tierTone } from "@/lib/itemLevelTier";

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
/** Column widths in rem for the desktop table (see the colgroup below), so they scale with the text size. */
const CHARACTER_COLUMN = 12.5;
/** More characters than this and the table scrolls inside the card with its header row pinned. */
const TALL_ROSTER = 8;
const TASK_COLUMN = 7.5;
/** A plain checkbox (a weekly like the Growth Boost Shop) needs no room for a picker. */
const CHECKBOX_COLUMN = 5.5;
const columnWidth = (task: Task) =>
  task.category !== "raid" && task.difficulties.length === 0 && !task.counted && task.rest_max === 0 ? CHECKBOX_COLUMN : TASK_COLUMN;
const EXTRA_COLUMN = 6;
const rem = (n: number) => `${n}rem`;

function tierProps(itemLevel: number, raids: Task[]) {
  const tier = bestRaidTier(itemLevel, raids);
  return { tone: tierTone(tier), hint: tierHint(tier) };
}

export default function TaskTable({
  characters,
  columns,
  extraColumns = [],
  renderCell,
  columnNote,
  onItemLevel,
  onGoldEarner,
  characterNote,
  characterAction,
  characterGoal,
  applies,
  cellKeyboard,
  onRowAll,
  hideWhenEmpty = false,
  raids,
}: {
  characters: Character[];
  columns: Task[];
  extraColumns?: ExtraColumn[];
  renderCell: (character: Character, task: Task) => ReactNode;
  columnNote?: (task: Task) => ReactNode;
  onItemLevel: (character: Character, itemLevel: number) => void;
  /** Shown as a GOLD toggle beside the name when given. */
  onGoldEarner?: (character: Character, isGoldEarner: boolean) => void;
  characterNote?: (character: Character) => ReactNode;
  /** A small button beside the name, e.g. "mark all done". */
  characterAction?: (character: Character) => ReactNode;
  /** Under the item level, e.g. the next unlock. */
  characterGoal?: (character: Character) => ReactNode;
  /** In the stacked layout, tasks that don't apply to a character are left out. */
  applies?: (character: Character, task: Task) => boolean;
  cellKeyboard?: (character: Character, task: Task) => CellKeyboard;
  /** The `a` key: mark the character's remaining tasks in this card done. */
  onRowAll?: (character: Character) => void;
  /** Render nothing, rather than "Nothing to show", when there are no rows. */
  hideWhenEmpty?: boolean;
  /** Every raid, to colour item levels by the best tier they reach. */
  raids?: Task[];
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
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // Keys pressed on a control inside the cell (a clicked checkbox or button)
    // still drive the grid; dropdowns and text fields keep their own keys, and
    // Space/Enter stay with the control so nothing toggles twice.
    const inside = event.target !== event.currentTarget;
    const target = event.target as HTMLElement;
    if (inside && (target.tagName === "SELECT" || isTypingTarget(target))) return;
    const moved = moveFocus({ row, col }, event.key, characters.length, rowTasks[row].length);
    const act = (run?: () => void) => {
      event.preventDefault();
      run?.();
    };
    if (moved) act(() => focusCell(moved.row, moved.col));
    else if (event.key === " " || event.key === "Enter") {
      if (!inside) act(keys.toggle);
    }
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
        className="h-full rounded-sm outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
      >
        {renderCell(character, task)}
      </div>
    );
  };

  const who = (character: Character) => (
    <>
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col items-center gap-1">
          {/* Decorative: the class is written beside it. Sized in rem to follow the text size. */}
          <GameIcon name={classIconName(character.class_name)} size={34} rem alt="" />
          {/* Its slot keeps its height when All goes away, so the row never moves. */}
          {characterAction && <div className="flex h-6 items-center">{characterAction(character)}</div>}
        </div>
        <div className="min-w-0 flex-1">
      {/* A fixed height: the All button coming and going never changes the row. */}
      <div className="flex h-6 items-center gap-1.5">
        <span className="min-w-0 truncate font-medium" title={character.name}>{character.name}</span>
        {onGoldEarner ? (
          <button
            onClick={() => onGoldEarner(character, !character.is_gold_earner)}
            aria-pressed={character.is_gold_earner}
            aria-label={`${character.name} earns raid gold`}
            title={
              character.is_gold_earner
                ? "Gold earner: paid for 3 raids a week. Click to make a non-earner."
                : "Not a gold earner: no raid gold, but bonus boxes are free for 3 raids a week. Click to make a gold earner (6 per account)."
            }
            className={`rounded px-1.5 text-xs font-semibold ${
              character.is_gold_earner ? "bg-accent/15 text-accent hover:bg-accent/25" : "border border-dashed border-border text-muted hover:border-accent/60 hover:text-foreground"
            }`}
          >
            GOLD
          </button>
        ) : (
          character.is_gold_earner && (
            <span title="Gold earner" className="rounded bg-accent/15 px-1.5 text-xs font-semibold text-accent">
              GOLD
            </span>
          )
        )}
      </div>
      <div className="truncate text-xs text-muted">
        {character.class_name} ·{" "}
        <ItemLevelEdit
          value={character.item_level}
          characterName={character.name}
          onSave={(value) => onItemLevel(character, value)}
          {...(raids ? tierProps(character.item_level, raids) : {})}
        />
      </div>
        </div>
      </div>
      {characterGoal?.(character)}
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
                  <div className="truncate px-2 pt-1.5 text-xs font-medium text-muted">
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

  // Fixed column widths: what a cell shows after ticking (bonus box, run
  // counts, rest) can never resize a column and move the checkboxes.
  // A big roster scrolls inside the card, so the header row can stay in view.
  const tall = characters.length > TALL_ROSTER;
  const minWidth = CHARACTER_COLUMN + columns.reduce((sum, task) => sum + columnWidth(task), 0) + extraColumns.length * EXTRA_COLUMN;
  return (
    <div className={`overflow-x-auto ${tall ? "max-h-[75vh] overflow-y-auto" : ""}`}>
      <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: rem(minWidth) }}>
        <colgroup>
          <col style={{ width: rem(CHARACTER_COLUMN) }} />
          {columns.map((task) => (
            <col key={task.id} style={{ width: rem(columnWidth(task)) }} />
          ))}
          {extraColumns.map((column) => (
            <col key={column.key} style={{ width: rem(EXTRA_COLUMN) }} />
          ))}
        </colgroup>
        <thead>
          <tr className={`border-b border-border text-xs text-muted ${tall ? "sticky top-0 z-20 bg-surface shadow-[0_1px_0_var(--border)]" : ""}`}>
            <th className="sticky left-0 z-10 bg-surface py-2 pl-4 pr-2 text-left font-medium">Character</th>
            {columns.map((task) => (
              <th key={task.id} className="px-2 py-2 text-center align-bottom font-medium">
                <div className="flex flex-col items-center gap-1 text-sm leading-tight text-foreground">
                  {taskIconName(task) && <GameIcon name={taskIconName(task)!} size={24} alt="" />}
                  {task.name}
                </div>
                {columnNote?.(task)}
              </th>
            ))}
            {extraColumns.map((column) => (
              <th key={column.key} title={column.title} className="px-4 py-2 text-right align-bottom font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {characters.map((character, row) => (
            <tr key={character.id} className="border-b border-border last:border-b-0">
              <td className="sticky left-0 z-10 bg-surface py-2 pl-4 pr-2">{who(character)}</td>
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
