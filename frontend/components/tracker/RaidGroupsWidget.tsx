"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import { useUndo } from "@/components/Toast";
import { Widget } from "@/components/tracker/Widgets";
import { api, Character, send, Task } from "@/lib/api";
import { memberStatuses, parseMembers, RaidGroup } from "@/lib/raidGroups";

type Draft = { name: string; taskId: string; schedule: string; members: string };
const EMPTY: Draft = { name: "", taskId: "", schedule: "", members: "" };

/**
 * Your statics: which raid, when, and who's in it. For each group, which of
 * your own characters in it still need the raid this week. Local only.
 */
export default function RaidGroupsWidget({
  characters,
  raids,
  isDone,
  onError,
}: {
  characters: Character[];
  raids: Task[];
  isDone: (characterId: number, taskId: number) => boolean;
  onError: (error: string) => void;
}) {
  const [groups, setGroups] = useState<RaidGroup[]>([]);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const offerUndo = useUndo();

  const load = useCallback(() => {
    api<RaidGroup[]>("/raid-groups")
      .then(setGroups)
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

  function startEdit(group: RaidGroup | null) {
    setEditing(group ? group.id : "new");
    setDraft(
      group
        ? { name: group.name, taskId: group.task_id ? String(group.task_id) : "", schedule: group.schedule ?? "", members: group.members.join(", ") }
        : EMPTY,
    );
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const body = {
      name: draft.name.trim(),
      task_id: draft.taskId ? Number(draft.taskId) : null,
      schedule: draft.schedule.trim() || null,
      members: parseMembers(draft.members),
    };
    run(() => (editing === "new" ? send("POST", "/raid-groups", body) : send("PATCH", `/raid-groups/${editing}`, body)));
    setEditing(null);
  }

  function remove(group: RaidGroup) {
    run(async () => {
      await send("DELETE", `/raid-groups/${group.id}`);
      offerUndo(`${group.name} deleted`, async () => {
        await send("POST", "/raid-groups", { name: group.name, task_id: group.task_id, schedule: group.schedule, members: group.members, notes: group.notes });
        load();
      });
    });
  }

  const raidName = (id: number | null) => raids.find((t) => t.id === id)?.name ?? "No raid set";

  const form = (
    <form onSubmit={save} className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
      <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Group name" aria-label="Group name" maxLength={100} />
      <select value={draft.taskId} onChange={(e) => setDraft({ ...draft, taskId: e.target.value })} aria-label="Group raid">
        <option value="">Raid…</option>
        {raids.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input value={draft.schedule} onChange={(e) => setDraft({ ...draft, schedule: e.target.value })} placeholder="When, e.g. Wed 20:00" aria-label="Group schedule" maxLength={100} />
      <input
        value={draft.members}
        onChange={(e) => setDraft({ ...draft, members: e.target.value })}
        placeholder="Members: Bardy, Friendo, ..."
        aria-label="Group members"
      />
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">Save group</button>
        <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">Cancel</button>
      </div>
    </form>
  );

  return (
    <Widget
      icon="raid-groups"
      title="Raid groups"
      hint="Your statics, and which of your characters in each still need the raid."
      action={
        <button onClick={() => startEdit(null)} className="text-xs text-muted underline hover:text-foreground">
          Add group
        </button>
      }
    >
      {groups.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted">
          Keep your statics here: the raid, when, and who&apos;s in it. You&apos;ll see which of your characters in each still
          need it this week.
        </p>
      )}
      <ul className="space-y-3">
        {groups.map((group) => {
          if (editing === group.id) return <li key={group.id}>{form}</li>;
          const members = memberStatuses(group, characters, isDone);
          const left = members.filter((m) => m.status === "left");
          return (
            <li key={group.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{group.name}</span>
                <span className="text-xs text-muted">
                  {raidName(group.task_id)}
                  {group.schedule ? ` · ${group.schedule}` : ""}
                </span>
                <span className="ml-auto flex gap-0.5">
                  <button onClick={() => startEdit(group)} aria-label={`Edit ${group.name}`} className="rounded p-0.5 text-muted hover:text-foreground">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => remove(group)} aria-label={`Delete ${group.name}`} className="rounded p-0.5 text-muted hover:text-danger">
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {members.map((m) => (
                  <span
                    key={m.name}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      m.status === "done"
                        ? "border-done/40 bg-done/10 text-done"
                        : m.status === "left"
                          ? "border-accent/50 bg-accent/10"
                          : "border-border text-muted"
                    }`}
                    title={m.status === "done" ? "Done this week" : m.status === "left" ? "Still needs it this week" : "Not one of your characters"}
                  >
                    {m.status === "done" && <Check size={10} className="mr-0.5 inline" />}
                    {m.name}
                  </span>
                ))}
              </div>
              {group.task_id !== null && members.some((m) => m.character) && (
                <p className="mt-1 text-xs text-muted">
                  {left.length ? `${left.length} of yours still need${left.length === 1 ? "s" : ""} it this week` : "All of yours are done this week"}
                </p>
              )}
            </li>
          );
        })}
        {editing === "new" && <li>{form}</li>}
      </ul>
    </Widget>
  );
}
