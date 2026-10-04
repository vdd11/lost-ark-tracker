"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import AccountsBar from "@/components/AccountsBar";
import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import AddCharacterForm from "@/components/settings/AddCharacterForm";
import BackupSection from "@/components/settings/BackupSection";
import CharacterRow from "@/components/settings/CharacterRow";
import { AddTaskForm, TaskGroup } from "@/components/settings/TaskLists";
import { useDragReorder } from "@/components/useDragReorder";
import { Account, api, byPosition, CATEGORIES, Character, MAX_GOLD_EARNERS, send, Task } from "@/lib/api";
import { renumber } from "@/lib/order";
import { isActiveRaid } from "@/lib/raids";

type Positioned = { id: number; position: number };

export default function SettingsPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a restore so rows drop their drafts of the old data.
  const [dataVersion, setDataVersion] = useState(0);

  const load = useCallback(() => {
    Promise.all([api<Character[]>("/characters"), api<Task[]>("/tasks"), api<Account[]>("/accounts")])
      .then(([characterData, taskData, accountData]) => {
        setCharacters(characterData.sort(byPosition));
        setTasks(taskData.sort(byPosition));
        setAccounts(accountData);
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

  const multipleAccounts = accounts.length > 1;
  // The gold earner limit is per account (each account is its own roster).
  const overLimit = accounts
    .map((account) => ({
      account,
      earners: characters.filter((c) => c.account_id === account.id && c.is_gold_earner).length,
    }))
    .filter(({ earners }) => earners > MAX_GOLD_EARNERS);

  /** Save a new order: show it right away, then store the positions that changed. */
  function saveOrder<T extends Positioned>(ordered: T[], path: string, apply: (renumbered: T[]) => void) {
    const { ordered: renumbered, changed } = renumber(ordered);
    apply(renumbered);
    mutate(() => Promise.all(changed.map((item) => send("PATCH", `${path}/${item.id}`, { position: item.position }))));
  }

  const characterDrag = useDragReorder(characters, (ordered) => saveOrder(ordered, "/characters", setCharacters));

  return (
    <div className="space-y-10">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <section>
        <h1 className="mb-1 text-2xl font-bold">Characters</h1>
        <p className="mb-4 text-sm text-muted">
          Gold earners get raid gold counted toward your weekly total (up to {MAX_GOLD_EARNERS} per account).
        </p>

        <AccountsBar
          accounts={accounts}
          onAdd={(name) => mutate(() => send("POST", "/accounts", { name }))}
          onRename={(account, name) => mutate(() => send("PATCH", `/accounts/${account.id}`, { name }))}
          onDelete={(account) => mutate(() => send("DELETE", `/accounts/${account.id}`))}
        />

        {overLimit.map(({ account, earners }) => (
          <p key={account.id} className="mb-4 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
            {earners} characters{multipleAccounts ? ` on ${account.name}` : ""} are marked as gold earners, but only{" "}
            {MAX_GOLD_EARNERS} per account earn raid gold. Untick the ones you don&apos;t designate in game
            {multipleAccounts ? ", or move some to another account" : ""} so your possible gold stays accurate.
          </p>
        ))}

        <AddCharacterForm
          accounts={multipleAccounts ? accounts : []}
          raids={tasks.filter((t) => isActiveRaid(t))}
          onAdd={(data) => mutate(() => send("POST", "/characters", data))}
        />

        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="w-8 py-2 pl-2" aria-label="Order" />
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Class</th>
                <th className="px-3 py-2 font-medium">Item level</th>
                <th className="px-3 py-2 font-medium">Gold earner</th>
                {multipleAccounts && <th className="px-3 py-2 font-medium">Account</th>}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {characterDrag.order.map((character) => (
                <CharacterRow
                  key={`${character.id}-${dataVersion}`}
                  character={character}
                  accounts={multipleAccounts ? accounts : []}
                  rowRef={characterDrag.rowRef(character.id)}
                  dragging={characterDrag.draggingId === character.id}
                  handle={characterDrag.handleProps(character, character.name)}
                  onSave={(changes) => mutate(() => send("PATCH", `/characters/${character.id}`, changes))}
                  onDelete={() => {
                    if (confirm(`Delete ${character.name}? Their past gold stays in your history.`)) {
                      mutate(() => send("DELETE", `/characters/${character.id}`));
                    }
                  }}
                />
              ))}
              {characters.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-muted">No characters yet.</td>
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
          {CATEGORIES.filter((category) => category.value !== "raid").map((category) => (
            <TaskGroup
              key={category.value}
              title={category.label}
              tasks={tasks.filter((t) => t.category === category.value)}
              dataVersion={dataVersion}
              onReorder={(ordered) =>
                saveOrder(ordered, "/tasks", (renumbered) =>
                  setTasks((prev) => prev.map((t) => renumbered.find((r) => r.id === t.id) ?? t).sort(byPosition)),
                )
              }
              onSave={(task, changes) => mutate(() => send("PATCH", `/tasks/${task.id}`, changes))}
              onDelete={(task) => {
                if (confirm(`Delete "${task.name}"? Gold already earned from it stays in your history.`)) {
                  mutate(() => send("DELETE", `/tasks/${task.id}`));
                }
              }}
            />
          ))}
        </div>
      </section>

      <BackupSection
        onError={setError}
        onRestored={() => {
          setDataVersion((v) => v + 1);
          load();
        }}
      />
    </div>
  );
}
