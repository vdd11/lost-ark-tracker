"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import { api, byPosition, Character, Difficulty, DifficultyDraft, EventTemplate, send, Task } from "@/lib/api";
import { formatItemLevel, GOLD_RAIDS_PER_WEEK, isActiveRaid } from "@/lib/raids";

type Tab = "raids" | "events";

export default function RaidsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tab, setTab] = useState<Tab>("raids");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([api<Task[]>("/tasks?include_archived=true"), api<Character[]>("/characters")])
      .then(([taskData, characterData]) => {
        setTasks(taskData.filter((t) => t.category === "raid").sort(byPosition));
        setCharacters(characterData.sort(byPosition));
        setError(null);
      })
      .catch((e) => setError(describeError(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      load();
    } catch (e) {
      setError(describeError(e));
    }
  }

  // Events are the raids with an end date.
  const shown = tasks.filter((t) => (tab === "events") === Boolean(t.ends_on));
  const active = shown.filter((t) => isActiveRaid(t));
  const inactive = shown.filter((t) => !isActiveRaid(t));
  const unknownGold = active.flatMap((t) => t.difficulties.filter((d) => d.gold === null).map((d) => `${t.name} ${d.name}`));
  const liveEvents = tasks.filter((t) => t.ends_on && isActiveRaid(t)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Raids</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          What can be run right now, the item level each difficulty needs, and the total gold for all gates. Each
          character gets gold from {GOLD_RAIDS_PER_WEEK} raids a week (event raids aside), and raids reset Wednesday
          10:00 UTC. Values follow app updates unless you change them yourself.
        </p>
      </div>

      <div className="flex w-fit rounded-md border border-border bg-surface p-0.5 text-sm">
        {(["raids", "events"] as Tab[]).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded px-3 py-1 ${tab === value ? "bg-surface-2 font-medium" : "text-muted"}`}
          >
            {value === "raids" ? "Raids" : `Events${liveEvents ? ` (${liveEvents})` : ""}`}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {unknownGold.length > 0 && (
        <p className="rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          Gold isn&apos;t known yet for: {unknownGold.join(", ")}. Enter it below and your weekly totals will use it.
        </p>
      )}

      {tab === "events" && (
        <EventForm onCreate={(data) => mutate(() => send("POST", "/event-raids", data))} onError={setError} />
      )}

      {active.map((task) => (
        <RaidCard key={task.id} task={task} characters={characters} mutate={mutate} />
      ))}
      {tab === "events" && active.length === 0 && (
        <p className="text-sm text-muted">No event raids running. Add one above when an Extreme raid goes live.</p>
      )}

      {tab === "raids" && (
        <AddRaidForm onAdd={(name) => mutate(() => send("POST", "/tasks", { name, category: "raid" }))} />
      )}

      {inactive.length > 0 && (
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-2 font-semibold">{tab === "events" ? "Past events" : "Hidden raids"}</h2>
          <ul className="space-y-1.5 text-sm">
            {inactive.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3">
                <span>
                  {task.name}{" "}
                  <span className="text-muted">
                    {task.archived ? "hidden" : `ended ${new Date(`${task.ends_on}T00:00:00`).toLocaleDateString()}`}
                  </span>
                </span>
                {task.archived && (
                  <button
                    onClick={() => mutate(() => send("PATCH", `/tasks/${task.id}`, { archived: false }))}
                    className="rounded border border-border px-2 py-0.5 hover:bg-surface-2"
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const OTHER_BASE = "__other__";

/** The Wednesday reset at least four weeks out: how long Extreme events usually run. */
function defaultEventEnd() {
  const date = new Date();
  date.setDate(date.getDate() + 28);
  date.setDate(date.getDate() + ((3 - date.getDay() + 7) % 7));
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Add an Extreme (or other limited-time) raid: pick the raid, check the defaults, done. */
function EventForm({ onCreate, onError }: { onCreate: (data: object) => Promise<void>; onError: (error: string) => void }) {
  const [template, setTemplate] = useState<EventTemplate | null>(null);
  const [base, setBase] = useState("");
  const [customName, setCustomName] = useState("");
  const [endsOn, setEndsOn] = useState(defaultEventEnd);
  const [rows, setRows] = useState<DifficultyDraft[]>([]);

  useEffect(() => {
    api<EventTemplate>("/event-raids/template")
      .then((data) => {
        setTemplate(data);
        setBase(data.bases[0] ?? OTHER_BASE);
        setRows(data.difficulties);
      })
      .catch((e) => onError(describeError(e)));
  }, [onError]);

  const name = base === OTHER_BASE ? customName.trim() : `${base} Extreme`;

  function updateRow(index: number, changes: Partial<DifficultyDraft>) {
    setRows(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({ name, ends_on: endsOn, difficulties: rows.filter((row) => row.name.trim()) });
    if (template) setRows(template.difficulties);
    setCustomName("");
    setEndsOn(defaultEventEnd());
  }

  if (!template) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border bg-surface p-4 text-sm">
      <h2 className="font-semibold">Add an event raid</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Which raid is getting an Extreme mode?
          <select value={base} onChange={(e) => setBase(e.target.value)} className="text-sm text-foreground">
            {template.bases.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
            <option value={OTHER_BASE}>Something else…</option>
          </select>
        </label>
        {base === OTHER_BASE && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Event name
            <input required value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Thaemine Extreme" className="text-sm text-foreground" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Ends on (it disappears that day)
          <input required type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="text-sm text-foreground" />
        </label>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">
          Difficulties, prefilled from past Extreme raids. Adjust them to match the patch notes.
        </p>
        <div className="space-y-1.5">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <input value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} aria-label="Difficulty" className="w-32" />
              <input
                type="number"
                step="any"
                value={row.min_item_level}
                onChange={(e) => updateRow(index, { min_item_level: Number(e.target.value) || 0 })}
                aria-label={`${row.name} item level`}
                className="w-24"
              />
              <input
                type="number"
                min="0"
                placeholder="Gold"
                value={row.gold ?? ""}
                onChange={(e) => updateRow(index, { gold: e.target.value === "" ? null : Number(e.target.value) })}
                aria-label={`${row.name} gold`}
                className="w-28"
              />
              <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== index))} className="rounded px-1.5 text-xs text-danger hover:bg-danger/10">
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows([...rows, { name: "", min_item_level: 0, gold: null }])}
            className="text-xs text-muted underline"
          >
            Add difficulty
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!name || rows.length === 0} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-40">
          Add {name || "event"}
        </button>
        <span className="text-xs text-muted">One clear per roster per week. Pays gold to any character, on top of the 3-raid limit.</span>
      </div>
    </form>
  );
}

function RaidCard({
  task,
  characters,
  mutate,
}: {
  task: Task;
  characters: Character[];
  mutate: (action: () => Promise<unknown>) => void;
}) {
  const isCustom = !task.catalog_key;
  const runners = characters.filter((c) => c.task_ids.includes(task.id));

  return (
    <section className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold">
            {task.name}
            {task.ends_on && (
              <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
                until {new Date(`${task.ends_on}T00:00:00`).toLocaleDateString()}
              </span>
            )}
            {isCustom && !task.ends_on && <span className="ml-2 text-xs font-normal text-muted">custom</span>}
          </h2>
          {task.note && <p className="mt-0.5 text-xs text-muted">{task.note}</p>}
        </div>
        <button
          onClick={() => {
            const message = isCustom
              ? `Delete "${task.name}"? Gold already earned from it stays in your history.`
              : `Hide "${task.name}"? You can restore it at the bottom of this page.`;
            if (confirm(message)) mutate(() => send("DELETE", `/tasks/${task.id}`));
          }}
          className="rounded px-2 py-0.5 text-sm text-danger hover:bg-danger/10"
        >
          {isCustom ? "Delete" : "Hide"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">Difficulty</th>
              <th className="px-2 py-2 font-medium">Item level</th>
              <th className="px-2 py-2 font-medium">Gold</th>
              <th className="px-2 py-2 font-medium">Your characters who qualify</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {task.difficulties.map((difficulty) => (
              <DifficultyRow
                key={`${difficulty.id}-${difficulty.gold}-${difficulty.min_item_level}`}
                difficulty={difficulty}
                characters={characters}
                runners={runners.filter((c) => c.difficulty_ids[String(task.id)] === difficulty.id)}
                mutate={mutate}
              />
            ))}
            {task.difficulties.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-2 text-muted">No difficulties yet. Add one below.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isCustom && (
        <AddDifficultyForm onAdd={(data) => mutate(() => send("POST", `/tasks/${task.id}/difficulties`, data))} />
      )}
    </section>
  );
}

function DifficultyRow({
  difficulty,
  characters,
  runners,
  mutate,
}: {
  difficulty: Difficulty;
  characters: Character[];
  runners: Character[];
  mutate: (action: () => Promise<unknown>) => void;
}) {
  const [itemLevel, setItemLevel] = useState(String(difficulty.min_item_level));
  const [gold, setGold] = useState(difficulty.gold === null ? "" : String(difficulty.gold));
  const isBuiltIn = difficulty.catalog_item_level !== null;
  const customized =
    isBuiltIn && (difficulty.gold !== difficulty.catalog_gold || difficulty.min_item_level !== difficulty.catalog_item_level);
  const qualifying = characters.filter((c) => c.item_level >= difficulty.min_item_level);
  const path = `/difficulties/${difficulty.id}`;

  function saveItemLevel() {
    const value = Number(itemLevel);
    if (itemLevel.trim() !== "" && Number.isFinite(value) && value !== difficulty.min_item_level) {
      mutate(() => send("PATCH", path, { min_item_level: value }));
    }
  }

  function saveGold() {
    const value = gold.trim() === "" ? null : Math.max(0, Math.round(Number(gold)));
    if (value !== difficulty.gold && (value === null || Number.isFinite(value))) {
      mutate(() => send("PATCH", path, { gold: value }));
    }
  }

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2 font-medium">{difficulty.name}</td>
      <td className="px-2 py-2">
        <input
          type="number"
          step="any"
          min="0"
          value={itemLevel}
          onChange={(e) => setItemLevel(e.target.value)}
          onBlur={saveItemLevel}
          aria-label={`${difficulty.name} item level`}
          className="w-20"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          min="0"
          placeholder="?"
          value={gold}
          onChange={(e) => setGold(e.target.value)}
          onBlur={saveGold}
          aria-label={`${difficulty.name} gold`}
          className={`w-24 ${difficulty.gold === null ? "border-accent" : ""}`}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {qualifying.map((c) => (
            <span
              key={c.id}
              title={`${c.name} · ${formatItemLevel(c.item_level)}`}
              className={`rounded px-1.5 py-0.5 text-xs ${
                runners.some((r) => r.id === c.id) ? "bg-done/15 text-done" : "bg-surface-2 text-muted"
              }`}
            >
              {c.name}
            </span>
          ))}
          {qualifying.length === 0 && <span className="text-xs text-muted">None yet</span>}
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        {customized && (
          <button
            onClick={() => mutate(() => send("POST", `${path}/reset`))}
            title={`Back to ${difficulty.catalog_gold ?? "?"} gold at ${difficulty.catalog_item_level}`}
            className="rounded px-1.5 text-xs text-muted hover:bg-surface-2"
          >
            Reset
          </button>
        )}
        {!isBuiltIn && (
          <button
            onClick={() => mutate(() => send("DELETE", path))}
            className="rounded px-1.5 text-xs text-danger hover:bg-danger/10"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

function AddDifficultyForm({ onAdd }: { onAdd: (data: object) => void }) {
  const [name, setName] = useState("");
  const [itemLevel, setItemLevel] = useState("");
  const [gold, setGold] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAdd({
      name: name.trim(),
      min_item_level: Number(itemLevel) || 0,
      gold: gold.trim() === "" ? null : Number(gold),
    });
    setName("");
    setItemLevel("");
    setGold("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 border-t border-border px-4 py-2 text-sm">
      <input required placeholder="Difficulty, e.g. Hard" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
      <input type="number" step="any" min="0" placeholder="Item level" value={itemLevel} onChange={(e) => setItemLevel(e.target.value)} className="w-24" />
      <input type="number" min="0" placeholder="Gold" value={gold} onChange={(e) => setGold(e.target.value)} className="w-24" />
      <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
        Add difficulty
      </button>
    </form>
  );
}

function AddRaidForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onAdd(name.trim());
        setName("");
      }}
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <input required placeholder="Raid not listed? Add it, e.g. Thaemine" value={name} onChange={(e) => setName(e.target.value)} className="w-72" />
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
        Add custom raid
      </button>
    </form>
  );
}
