"use client";

import { useCallback, useEffect, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import AddRaidForm from "@/components/raids/AddRaidForm";
import EventForm from "@/components/raids/EventForm";
import RaidCard from "@/components/raids/RaidCard";
import { api, byPosition, Character, send, Task } from "@/lib/api";
import { GOLD_RAIDS_PER_WEEK, isActiveRaid } from "@/lib/raids";

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
