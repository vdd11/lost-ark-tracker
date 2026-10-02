"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";

import Link from "next/link";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import RaidPicker, { RaidSelection, suggestedRaids } from "@/components/RaidPicker";
import { api, byPosition, CATEGORIES, Character, send, Task, TaskCategory } from "@/lib/api";
import { isActiveRaid } from "@/lib/raids";

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

        <AddCharacterForm
          raids={tasks.filter((t) => isActiveRaid(t))}
          onAdd={(data) => mutate(() => send("POST", "/characters", data))}
        />

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
          Daily and weekly tracker columns. Dailies reset at 10:00 UTC, weeklies on Wednesday 10:00 UTC. New ones go
          to every character. Dailies can track a rest bonus: set Max to 0 to turn it off, or adjust the numbers if a
          patch changes them. Raids, with their gold and item levels, are on the{" "}
          <Link href="/raids" className="underline">Raids page</Link>.
        </p>

        <AddTaskForm onAdd={(data) => mutate(() => send("POST", "/tasks", data))} />

        <div className="grid gap-4 md:grid-cols-2">
          {CATEGORIES.filter((category) => category.value !== "raid").map((category) => {
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

      <BackupSection onError={setError} onRestored={load} />
    </div>
  );
}

function BackupSection({ onError, onRestored }: { onError: (error: string) => void; onRestored: () => void }) {
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    try {
      const backup = await api<object>("/backup");
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `lost-ark-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(describeError(e));
    }
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!confirm(`Replace ALL current data with "${file.name}"? Download a backup first if you might want it back.`)) return;

    try {
      await send("POST", "/backup", JSON.parse(await file.text()));
      setMessage(`Restored from ${file.name}.`);
      onRestored();
    } catch (e) {
      onError(e instanceof SyntaxError ? "That file isn't valid JSON." : describeError(e));
    }
  }

  return (
    <section>
      <h2 className="mb-1 text-2xl font-bold">Backup &amp; restore</h2>
      <p className="mb-4 text-sm text-muted">
        Your data lives only on this computer. Download a backup now and then, or to move your roster to another
        machine. Restoring replaces everything.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button onClick={download} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
          Download backup
        </button>
        <label className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5">
          Restore from file…
          <input type="file" accept="application/json,.json" onChange={restore} className="hidden" />
        </label>
        {message && <span className="text-done">{message}</span>}
      </div>
    </section>
  );
}

function AddCharacterForm({ raids, onAdd }: { raids: Task[]; onAdd: (data: object) => Promise<void> }) {
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [itemLevel, setItemLevel] = useState("");
  const [isGoldEarner, setIsGoldEarner] = useState(true);
  const [reservedFor, setReservedFor] = useState("");
  const [selectedRaids, setSelectedRaids] = useState<RaidSelection>({});
  // Until the raid list is changed by hand, it follows the item level.
  const [autoPick, setAutoPick] = useState(true);

  function changeItemLevel(value: string) {
    setItemLevel(value);
    if (autoPick) setSelectedRaids(suggestedRaids(raids, Number(value) || 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onAdd({
      name: name.trim(),
      class_name: className.trim(),
      item_level: Number(itemLevel) || 0,
      is_gold_earner: isGoldEarner,
      reserved_for: reservedFor.trim() || null,
      raids: Object.entries(selectedRaids).map(([taskId, difficultyId]) => ({
        task_id: Number(taskId),
        difficulty_id: difficultyId || null,
      })),
    });
    setName("");
    setClassName("");
    setItemLevel("");
    setReservedFor("");
    setSelectedRaids({});
    setAutoPick(true);
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
        onChange={(e) => changeItemLevel(e.target.value)}
        className="w-28"
      />
      <input placeholder="Saved for (optional)" value={reservedFor} onChange={(e) => setReservedFor(e.target.value)} />
      <label className="flex items-center gap-1.5 px-1 py-1.5">
        <input type="checkbox" checked={isGoldEarner} onChange={(e) => setIsGoldEarner(e.target.checked)} />
        Gold earner
      </label>
      <RaidPicker
        raids={raids}
        itemLevel={Number(itemLevel) || 0}
        isGoldEarner={isGoldEarner}
        value={selectedRaids}
        onChange={(value) => {
          setSelectedRaids(value);
          setAutoPick(false);
        }}
      />
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
      <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
        {CATEGORIES.filter((c) => c.value !== "raid").map((c) => (
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
