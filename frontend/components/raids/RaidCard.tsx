"use client";

import { FormEvent, useState } from "react";

import NumberInput from "@/components/NumberInput";
import { Character, Difficulty, send, Task } from "@/lib/api";
import { formatItemLevel } from "@/lib/raids";

export default function RaidCard({
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
              <th className="px-2 py-2 font-medium" title="Share of the gold that's bound, and to the roster or the character">Bound</th>
              <th className="px-2 py-2 font-medium" title="Gold to open every gate's bonus (View More) chest">Bonus chests</th>
              <th className="px-2 py-2 font-medium">Your characters who qualify</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {task.difficulties.map((difficulty) => (
              <DifficultyRow
                key={`${difficulty.id}-${difficulty.gold}-${difficulty.min_item_level}-${difficulty.bound_percent}-${difficulty.bonus_cost}`}
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
  const [bound, setBound] = useState(String(difficulty.bound_percent));
  const [bonus, setBonus] = useState(difficulty.bonus_cost === null ? "" : String(difficulty.bonus_cost));
  const isBuiltIn = difficulty.catalog_item_level !== null;
  const customized =
    isBuiltIn &&
    (difficulty.gold !== difficulty.catalog_gold ||
      difficulty.min_item_level !== difficulty.catalog_item_level ||
      difficulty.bound_percent !== (difficulty.catalog_bound_percent ?? 0) ||
      difficulty.bound_kind !== (difficulty.catalog_bound_kind ?? "roster") ||
      difficulty.bonus_cost !== difficulty.catalog_bonus_cost);
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

  function saveBonus() {
    const value = bonus.trim() === "" ? null : Math.max(0, Math.round(Number(bonus)));
    if (value !== difficulty.bonus_cost && (value === null || Number.isFinite(value))) {
      mutate(() => send("PATCH", path, { bonus_cost: value }));
    }
  }

  function saveBound() {
    const value = Math.max(0, Math.min(100, Math.round(Number(bound) || 0)));
    if (value !== difficulty.bound_percent) mutate(() => send("PATCH", path, { bound_percent: value }));
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
        <NumberInput
          placeholder="?"
          value={gold}
          onChange={setGold}
          onBlur={saveGold}
          aria-label={`${difficulty.name} gold`}
          className={`w-24 ${difficulty.gold === null ? "border-accent" : ""}`}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          min="0"
          max="100"
          value={bound}
          onChange={(e) => setBound(e.target.value)}
          onBlur={saveBound}
          aria-label={`${difficulty.name} bound gold percent`}
          className="w-16"
        />
        <span className="px-1 text-xs text-muted">%</span>
        <select
          value={difficulty.bound_kind}
          onChange={(e) => mutate(() => send("PATCH", path, { bound_kind: e.target.value }))}
          aria-label={`${difficulty.name} bound to`}
          className="py-1 text-xs"
        >
          <option value="roster">roster</option>
          <option value="character">character</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <NumberInput
          placeholder="?"
          value={bonus}
          onChange={setBonus}
          onBlur={saveBonus}
          aria-label={`${difficulty.name} bonus chest cost`}
          className="w-24"
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
            title={`Back to ${difficulty.catalog_gold ?? "?"} gold (${difficulty.catalog_bound_percent ?? 0}% bound) at ${difficulty.catalog_item_level}`}
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
      <NumberInput placeholder="Gold" value={gold} onChange={setGold} aria-label="Gold" className="w-24" />
      <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
        Add difficulty
      </button>
    </form>
  );
}
