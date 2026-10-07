"use client";

import { FormEvent, useState } from "react";

import NumberInput from "@/components/NumberInput";
import { DeleteButton, DragHandle, DragHandleProps, draggingRow } from "@/components/settings/controls";
import { useDragReorder } from "@/components/useDragReorder";
import { CATEGORIES, Task, TaskCategory } from "@/lib/api";

export function TaskGroup({
  title,
  tasks,
  dataVersion,
  onReorder,
  onSave,
  onDelete,
}: {
  title: string;
  tasks: Task[];
  dataVersion: number;
  onReorder: (ordered: Task[]) => void;
  onSave: (task: Task, changes: Partial<Task>) => void;
  onDelete: (task: Task) => void;
}) {
  const drag = useDragReorder(tasks, onReorder);
  return (
    <div className="rounded-md border border-border bg-surface">
      <h3 className="border-b border-border px-3 py-2 font-semibold">{title}</h3>
      <ul>
        {drag.order.map((task) => (
          <TaskRow
            key={`${task.id}-${dataVersion}`}
            task={task}
            rowRef={drag.rowRef(task.id)}
            dragging={drag.draggingId === task.id}
            handle={drag.handleProps(task, task.name)}
            onSave={(changes) => onSave(task, changes)}
            onDelete={() => onDelete(task)}
          />
        ))}
        {tasks.length === 0 && <li className="px-3 py-3 text-sm text-muted">None</li>}
      </ul>
    </div>
  );
}

export function AddTaskForm({ onAdd }: { onAdd: (data: object) => Promise<void> }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TaskCategory>("daily");
  const [gold, setGold] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onAdd({ name: name.trim(), category, gold: Number(gold) || 0 });
    setName("");
    setGold("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 text-sm">
      <input required placeholder="Task name, e.g. Paradise" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
      <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} aria-label="New task resets">
        {CATEGORIES.filter((c) => c.value !== "raid").map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <NumberInput placeholder="Gold" value={gold} onChange={setGold} aria-label="Gold" className="w-28" />
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
        Add task
      </button>
    </form>
  );
}

function TaskRow({
  task,
  rowRef,
  dragging,
  handle,
  onSave,
  onDelete,
}: {
  task: Task;
  rowRef: (element: HTMLElement | null) => void;
  dragging: boolean;
  handle: DragHandleProps;
  onSave: (changes: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [gold, setGold] = useState(String(task.gold));

  return (
    <li
      ref={rowRef}
      className={`flex flex-wrap items-center gap-2 border-b border-border py-2 pl-1.5 pr-3 text-sm last:border-b-0 ${dragging ? draggingRow : ""}`}
    >
      <DragHandle handle={handle} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== task.name && onSave({ name: name.trim() })}
        className="min-w-0 flex-1"
        aria-label="Task name"
      />
      <label className="flex items-center gap-1 text-muted">
        <NumberInput
          value={gold}
          onChange={setGold}
          onBlur={() => (Number(gold) || 0) !== task.gold && onSave({ gold: Number(gold) || 0 })}
          className="w-24 text-foreground"
          aria-label={`${task.name} gold`}
        />
        g
      </label>
      <DeleteButton onDelete={onDelete} />
      {task.category === "daily" && <RestRulesEditor task={task} onSave={onSave} />}
    </li>
  );
}

const REST_FIELDS = [
  { key: "rest_max", label: "Max", hint: "Gauge capacity. 0 turns rest tracking off" },
  { key: "rest_gain", label: "+/day", hint: "Rest gained for each day the task is skipped" },
  { key: "rest_cost", label: "−/run", hint: "Rest a run spends for bonus rewards" },
] as const;

function RestRulesEditor({ task, onSave }: { task: Task; onSave: (changes: Partial<Task>) => void }) {
  const [draft, setDraft] = useState({
    rest_max: String(task.rest_max),
    rest_gain: String(task.rest_gain),
    rest_cost: String(task.rest_cost),
  });

  return (
    <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span>Rest bonus</span>
      {REST_FIELDS.map((field) => (
        <label key={field.key} title={field.hint} className="flex items-center gap-1">
          {field.label}
          <input
            type="number"
            min="0"
            value={draft[field.key]}
            onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
            onBlur={() => {
              const value = Math.max(0, Math.round(Number(draft[field.key]) || 0));
              if (value !== task[field.key]) onSave({ [field.key]: value });
            }}
            className="w-14 px-1 py-0.5 text-foreground"
            aria-label={`${task.name} rest bonus ${field.label}`}
          />
        </label>
      ))}
    </div>
  );
}
