"use client";

import { Skull, Tornado } from "lucide-react";
import { useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import GameIcon from "@/components/GameIcon";
import NumberInput from "@/components/NumberInput";
import { useUndo } from "@/components/Toast";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { formatGold, send } from "@/lib/api";
import { sourceIconName } from "@/lib/data/icons";
import { dropsFrom, eventsOn, FieldEvent, nextEvent } from "@/lib/fieldEvents";

const ICONS = { "Field Boss": Skull, "Chaos Gate": Tornado } as const;
const GEM_LEVELS = [1, 2, 3, 4, 5];

/**
 * Field Boss and Chaos Gate days, at the foot of the Today card: their gem
 * drops are random, so "Log drops" records what you actually got (gems, and
 * gold from selling the rest). Optional; turned on under Customize.
 */
export default function FieldDrops({ data }: { data: TrackerData }) {
  const [open, setOpen] = useState<FieldEvent | null>(null);
  const [logged, setLogged] = useState<Partial<Record<FieldEvent, string>>>({});
  const period = data.tracker?.daily_period;
  if (!period) return null;
  const today = eventsOn(period);
  const next = today.length ? null : nextEvent(period);

  return (
    <div className="border-t border-border px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {today.length === 0 && next && (
          <span className="text-muted">
            No Field Boss or Chaos Gate today; {next.event} {next.day}.
          </span>
        )}
        {today.map((event) => (
          <span key={event} className="flex items-center gap-2">
            <GameIcon name={sourceIconName(event)} size={16} fallback={ICONS[event]} alt="" className="text-accent" />
            <span className="font-medium">{event} today</span>
            {logged[event] && <span className="text-xs text-done">logged {logged[event]}</span>}
            <button
              onClick={() => setOpen(open === event ? null : event)}
              aria-expanded={open === event}
              className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-surface-2"
            >
              Log drops
            </button>
          </span>
        ))}
      </div>
      {open && (
        <DropsForm
          key={open}
          event={open}
          data={data}
          onDone={(summary) => {
            setLogged({ ...logged, [open]: summary });
            setOpen(null);
          }}
          onCancel={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function DropsForm({
  event,
  data,
  onDone,
  onCancel,
}: {
  event: FieldEvent;
  data: TrackerData;
  onDone: (summary: string) => void;
  onCancel: () => void;
}) {
  const [characterId, setCharacterId] = useState("");
  const [gems, setGems] = useState<Record<number, string>>({});
  const [gold, setGold] = useState("");
  const [saving, setSaving] = useState(false);
  const offerUndo = useUndo();
  const drops = dropsFrom(gems, gold);

  async function save() {
    if (!drops.gems && !drops.gold) return;
    setSaving(true);
    const character_id = characterId ? Number(characterId) : null;
    try {
      const made: string[] = [];
      if (drops.gems) {
        const entry = await send<{ id: number }>("POST", "/gem-entries", { source: event, gems: drops.gems, character_id });
        made.push(`/gem-entries/${entry.id}`);
      }
      if (drops.gold) {
        const entry = await send<{ id: number }>("POST", "/gold-entries", { source: event, amount: drops.gold, character_id });
        made.push(`/gold-entries/${entry.id}`);
      }
      data.loadWeeklyGold();
      const parts = [
        ...Object.entries(drops.gems ?? {}).map(([level, count]) => `${count}× Lv${level}`),
        ...(drops.gold ? [`${formatGold(drops.gold)} gold`] : []),
      ];
      const summary = parts.join(", ");
      onDone(summary);
      offerUndo(`${event}: ${summary} logged`, async () => {
        for (const path of made) await send("DELETE", path);
        data.loadWeeklyGold();
      });
    } catch (e) {
      data.setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-2/40 p-2">
      <label className="flex flex-col gap-0.5 text-xs text-muted">
        Who
        <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} aria-label={`${event} character`} className="text-sm text-foreground">
          <option value="">Any character</option>
          {data.characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      {GEM_LEVELS.map((level) => (
        <label key={level} className="flex flex-col gap-0.5 text-xs text-muted">
          Lv{level} gems
          <NumberInput
            value={gems[level] ?? ""}
            onChange={(value) => setGems({ ...gems, [level]: value })}
            placeholder="0"
            aria-label={`${event} Lv${level} gems`}
            className="w-16 text-sm text-foreground"
          />
        </label>
      ))}
      <label className="flex flex-col gap-0.5 text-xs text-muted">
        Gold from selling
        <NumberInput value={gold} onChange={setGold} placeholder="0" aria-label={`${event} gold from selling`} className="w-28 text-sm text-foreground" />
      </label>
      <button
        onClick={save}
        disabled={saving || (!drops.gems && !drops.gold)}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
      >
        Save
      </button>
      <button onClick={onCancel} className="rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface-2">
        Cancel
      </button>
    </div>
  );
}
