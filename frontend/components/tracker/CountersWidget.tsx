"use client";

import { ListChecks, Minus, Plus, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { useUndo } from "@/components/Toast";
import { Widget } from "@/components/tracker/Widgets";
import { api, Character, formatGold, send } from "@/lib/api";
import { Counter, counterProgress, countersFor } from "@/lib/counters";

/**
 * Counters you keep by hand: collectibles, island tokens, reputation... a name,
 * a number and an optional target, for one character, one account or everyone.
 */
export default function CountersWidget({
  characters,
  accountId,
  onError,
}: {
  characters: Character[];
  /** The account tab shown, or 0 for all. */
  accountId: number;
  onError: (error: string) => void;
}) {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [characterId, setCharacterId] = useState("");
  const offerUndo = useUndo();

  const load = useCallback(() => {
    api<Counter[]>("/counters")
      .then(setCounters)
      .catch((e) => onError(describeError(e)));
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      onError(describeError(e));
    }
    load();
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    run(() =>
      send("POST", "/counters", {
        name: name.trim(),
        target: Number(target) > 0 ? Math.round(Number(target)) : null,
        character_id: characterId ? Number(characterId) : null,
        account_id: characterId ? null : accountId || null,
      }),
    );
    setName("");
    setTarget("");
  }

  function remove(counter: Counter) {
    run(async () => {
      await send("DELETE", `/counters/${counter.id}`);
      offerUndo(`${counter.name} deleted`, async () => {
        await send("POST", "/counters", {
          name: counter.name,
          value: counter.value,
          target: counter.target,
          character_id: counter.character_id,
          account_id: counter.character_id ? null : counter.account_id,
        });
        load();
      });
    });
  }

  const shown = countersFor(counters, accountId);
  const owner = (counter: Counter) => characters.find((c) => c.id === counter.character_id)?.name;

  return (
    <Widget
      icon={ListChecks}
      title="Counters"
      hint="Anything you count by hand: collectibles, tokens, reputation."
      action={
        <button onClick={() => setAdding(!adding)} className="text-xs text-muted underline hover:text-foreground">
          {adding ? "Done" : "Add / edit"}
        </button>
      }
    >

      {shown.length === 0 && !adding && (
        <p className="text-sm text-muted">
          Keep count of anything by hand: collectibles, tokens, reputation. <button onClick={() => setAdding(true)} className="underline">Add one</button>.
        </p>
      )}

      <ul className="space-y-1.5">
        {shown.map((counter) => {
          const progress = counterProgress(counter);
          return (
            <li key={counter.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={counter.name}>
                {counter.name}
                {owner(counter) && <span className="text-xs text-muted"> · {owner(counter)}</span>}
              </span>
              {progress !== null && (
                <span className="h-1.5 w-16 overflow-hidden rounded bg-surface-2" aria-hidden>
                  <span className={`block h-full ${progress >= 1 ? "bg-done" : "bg-accent"}`} style={{ width: `${Math.round(progress * 100)}%` }} />
                </span>
              )}
              <span className="tabular-nums">
                {formatGold(counter.value)}
                {counter.target ? <span className="text-muted"> / {formatGold(counter.target)}</span> : null}
              </span>
              <button
                onClick={() => run(() => send("PATCH", `/counters/${counter.id}`, { add: -1 }))}
                aria-label={`${counter.name} minus one`}
                className="rounded border border-border p-0.5 text-muted hover:text-foreground"
              >
                <Minus size={12} />
              </button>
              <button
                onClick={() => run(() => send("PATCH", `/counters/${counter.id}`, { add: 1 }))}
                aria-label={`${counter.name} plus one`}
                className="rounded border border-border p-0.5 text-muted hover:text-foreground"
              >
                <Plus size={12} />
              </button>
              {adding && (
                <button onClick={() => remove(counter)} aria-label={`Delete ${counter.name}`} className="rounded p-0.5 text-muted hover:text-danger">
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Mokoko seeds" aria-label="Counter name" maxLength={100} className="min-w-40 flex-1" />
          <input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" aria-label="Counter target" className="w-24" />
          <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} aria-label="Counter for">
            <option value="">{accountId ? "This account" : "Everyone"}</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button type="submit" disabled={!name.trim()} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-50">
            Add counter
          </button>
        </form>
      )}
    </Widget>
  );
}
