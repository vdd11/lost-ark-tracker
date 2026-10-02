"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import { api, byPosition, CATEGORIES, Character, send, Task, TaskCategory } from "@/lib/api";

type Positioned = { id: number; position: number };

/** Move an item one slot and renumber the list (old rows may share position 0). */
function reorder<T extends Positioned>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return null;

  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((item, position) => ({ ...item, position }));
}

export default function SettingsPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api<Character[]>("/characters"), api<Task[]>("/tasks")])
      .then(([characterData, taskData]) => {
        setCharacters(characterData.sort(byPosition));
        setTasks(taskData.sort(byPosition));
        setError(null);
      })
      .catch((e) => setError(describeError(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Every mutation goes through here: run it, then reload from the API.
  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      load();
    } catch (e) {
      setError(describeError(e));
    }
  }

  function move<T extends Positioned>(items: T[], index: number, direction: -1 | 1, path: string) {
    const renumbered = reorder(items, index, direction);
    if (!renumbered) return;
    mutate(() =>
      Promise.all(renumbered.map((item) => send("PATCH", `${path}/${item.id}`, { position: item.position }))),
    );
  }

  return (
    <div className="space-y-10">
      <ErrorBanner error={error} />

      <section>
        <h1 className="mb-1 text-2xl font-bold">Characters</h1>
        <p className="mb-4 text-sm text-muted">
          Gold earners get raid gold counted toward your weekly total. Fill in &quot;Saved for&quot; on characters
          you keep for a friend&apos;s clears.
        </p>

        <AddCharacterForm onAdd={(data) => mutate(() => send("POST", "/characters", data))} />

        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 font-medium">Item level</th>
                <th className="px-3 py-2 font-medium">Gold earner</th>
                <th className="px-3 py-2 font-medium">Saved for</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {characters.map((character, index) => (
                <CharacterRow
                  key={`${character.id}-${character.position}`}
                  character={character}
                  onSave={(changes) => mutate(() => send("PATCH", `/characters/${character.id}`, changes))}
                  onMove={(direction) => move(characters, index, direction, "/characters")}
                  onDelete={() => {
                    if (confirm(`Delete ${character.name}? Their past gold stays in your history.`)) {
                      mutate(() => send("DELETE", `/characters/${character.id}`));
                    }
                  }}
                />
              ))}
              {characters.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted">No characters yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold">Tasks</h2>
        <p className="mb-4 text-sm text-muted">
          These are the tracker columns. Dailies reset at 10:00 UTC; weeklies and raids reset Wednesday 10:00 UTC.
          Set each raid&apos;s gold to what it currently pays. Changing it later won&apos;t rewrite past weeks. New
          dailies and weeklies go to every character. Pick raids per character on the Tracker page.
        </p>

        <AddTaskForm onAdd={(data) => mutate(() => send("POST", "/tasks", data))} />

        <div className="grid gap-4 md:grid-cols-3">
          {CATEGORIES.map((category) => {
            const group = tasks.filter((t) => t.category === category.value);
            return (
              <div key={category.value} className="rounded-md border border-border bg-surface">
                <h3 className="border-b border-border px-3 py-2 font-semibold">{category.label}</h3>
                <ul>
                  {group.map((task, index) => (
                    <TaskRow
                      key={`${task.id}-${task.position}`}
                      task={task}
                      onSave={(changes) => mutate(() => send("PATCH", `/tasks/${task.id}`, changes))}
                      onMove={(direction) => move(group, index, direction, "/tasks")}
                      onDelete={() => {
                        if (confirm(`Delete "${task.name}"? Gold already earned from it stays in your history.`)) {
                          mutate(() => send("DELETE", `/tasks/${task.id}`));
                        }
                      }}
                    />
                  ))}
                  {group.length === 0 && <li className="px-3 py-3 text-sm text-muted">None</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AddCharacterForm({ onAdd }: { onAdd: (data: object) => Promise<void> }) {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [itemLevel, setItemLevel] = useState("");
  const [isGoldEarner, setIsGoldEarner] = useState(true);
  const [reservedFor, setReservedFor] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onAdd({
      name: name.trim(),
      class_name: className.trim(),
      item_level: Number(itemLevel) || 0,
      is_gold_earner: isGoldEarner,
      reserved_for: reservedFor.trim() || null,
    });
    setName("");
    setClassName("");
    setItemLevel("");
    setReservedFor("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 text-sm">
      <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input required placeholder="Class" value={className} onChange={(e) => setClassName(e.target.value)} />
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Item level"
        value={itemLevel}
        onChange={(e) => setItemLevel(e.target.value)}
        className="w-28"
      />
      <input placeholder="Saved for (optional)" value={reservedFor} onChange={(e) => setReservedFor(e.target.value)} />
      <label className="flex items-center gap-1.5 px-1 py-1.5">
        <input type="checkbox" checked={isGoldEarner} onChange={(e) => setIsGoldEarner(e.target.checked)} />
        Gold earner
      </label>
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
        Add character
      </button>
    </form>
  );
}

function RowActions({ onMove, onDelete }: { onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1 text-muted">
      <button onClick={() => onMove(-1)} aria-label="Move up" className="rounded px-1.5 hover:bg-surface-2">↑</button>
      <button onClick={() => onMove(1)} aria-label="Move down" className="rounded px-1.5 hover:bg-surface-2">↓</button>
      <button onClick={onDelete} className="rounded px-1.5 text-danger hover:bg-danger/10">Delete</button>
    </div>
  );
}

// Rows keep a local draft and save a field when it loses focus.
function CharacterRow({
  character,
  onSave,
  onMove,
  onDelete,
}: {
  character: Character;
  onSave: (changes: Partial<Character>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    name: character.name,
    class_name: character.class_name,
    item_level: String(character.item_level || ""),
    reserved_for: character.reserved_for ?? "",
  });

  function saveText(field: "name" | "class_name" | "reserved_for") {
    const value = draft[field].trim();
    const current = character[field] ?? "";
    if (value === current || (field !== "reserved_for" && !value)) return;
    onSave({ [field]: value || null });
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-1.5">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => saveText("name")} />
      </td>
      <td className="px-3 py-1.5">
        <input value={draft.class_name} onChange={(e) => setDraft({ ...draft, class_name: e.target.value })} onBlur={() => saveText("class_name")} />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-28"
          value={draft.item_level}
          onChange={(e) => setDraft({ ...draft, item_level: e.target.value })}
          onBlur={() => {
            const value = Number(draft.item_level) || 0;
            if (value !== character.item_level) onSave({ item_level: value });
          }}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="checkbox"
          checked={character.is_gold_earner}
          onChange={(e) => onSave({ is_gold_earner: e.target.checked })}
          aria-label={`${character.name} is a gold earner`}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          placeholder="—"
          value={draft.reserved_for}
          onChange={(e) => setDraft({ ...draft, reserved_for: e.target.value })}
          onBlur={() => saveText("reserved_for")}
        />
      </td>
      <td className="px-3 py-1.5">
        <RowActions onMove={onMove} onDelete={onDelete} />
      </td>
    </tr>
  );
}

function AddTaskForm({ onAdd }: { onAdd: (data: object) => Promise<void> }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TaskCategory>("raid");
  const [gold, setGold] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onAdd({ name: name.trim(), category, gold: Number(gold) || 0 });
    setName("");
    setGold("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 text-sm">
      <input required placeholder="Task name, e.g. Act 4 Hard" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
      <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <input type="number" min="0" placeholder="Gold" value={gold} onChange={(e) => setGold(e.target.value)} className="w-28" />
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
        Add task
      </button>
    </form>
  );
}

function TaskRow({
  task,
  onSave,
  onMove,
  onDelete,
}: {
  task: Task;
  onSave: (changes: Partial<Task>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [gold, setGold] = useState(String(task.gold));

  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== task.name && onSave({ name: name.trim() })}
        className="min-w-0 flex-1"
        aria-label="Task name"
      />
      <label className="flex items-center gap-1 text-muted">
        <input
          type="number"
          min="0"
          value={gold}
          onChange={(e) => setGold(e.target.value)}
          onBlur={() => (Number(gold) || 0) !== task.gold && onSave({ gold: Number(gold) || 0 })}
          className="w-24 text-foreground"
          aria-label={`${task.name} gold`}
        />
        g
      </label>
      <RowActions onMove={onMove} onDelete={onDelete} />
    </li>
  );
}
