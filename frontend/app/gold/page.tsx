"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import WeeklyGoldChart, { SeriesKey } from "@/components/WeeklyGoldChart";
import { api, Character, formatGold, GoldEntry, parseUtc, send, WeeklyGold } from "@/lib/api";

const SOURCES = ["Field Boss", "Chaos Gate", "Fate Ember", "Paradise", "Auction House", "Trade"];
const OTHER = "__other__";
const RANGES = [8, 12, 26, 52];
const VIEWS: { label: string; show: SeriesKey[] }[] = [
  { label: "All gold", show: ["raid_gold", "other_gold"] },
  { label: "Raid gold", show: ["raid_gold"] },
  { label: "Other gold", show: ["other_gold"] },
];

function todayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function GoldPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entries, setEntries] = useState<GoldEntry[]>([]);
  const [weeks, setWeeks] = useState<WeeklyGold[]>([]);
  const [range, setRange] = useState(12);
  const [showTable, setShowTable] = useState(false);
  const [view, setView] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api<Character[]>("/characters"),
      api<GoldEntry[]>("/gold-entries?limit=50"),
      api<WeeklyGold[]>(`/gold/weekly?weeks=${range}`),
    ])
      .then(([characterData, entryData, weekData]) => {
        setCharacters(characterData);
        setEntries(entryData);
        setWeeks(weekData);
        setError(null);
      })
      .catch((e) => setError(describeError(e)));
  }, [range]);

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

  const characterName = (id: number | null) => characters.find((c) => c.id === id)?.name ?? "";
  const thisWeek = weeks.at(-1);
  const lastWeek = weeks.at(-2);
  const average = weeks.length ? Math.round(weeks.reduce((sum, w) => sum + w.total, 0) / weeks.length) : 0;
  // What each character brings in: this week and the weekly average over the range.
  const characterRows = [...characters.map((c) => c.name), "Unassigned"]
    .map((name) => ({
      name,
      thisWeek: thisWeek?.by_character[name] ?? 0,
      average: Math.round(weeks.reduce((sum, w) => sum + (w.by_character[name] ?? 0), 0) / Math.max(1, weeks.length)),
    }))
    .filter((row) => row.thisWeek > 0 || row.average > 0)
    .sort((a, b) => b.average - a.average);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Gold</h1>
      <ErrorBanner error={error} />

      <AddGoldForm characters={characters} onAdd={(data) => mutate(() => send("POST", "/gold-entries", data))} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="This week" value={thisWeek?.total ?? 0} accent />
        <Tile label="Last week" value={lastWeek?.total ?? 0} />
        <Tile label={`Average, last ${range} weeks`} value={average} />
      </div>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Weekly gold</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex rounded-md border border-border p-0.5">
              {VIEWS.map((v, i) => (
                <button
                  key={v.label}
                  onClick={() => setView(i)}
                  className={`rounded px-3 py-1 ${view === i ? "bg-surface-2 font-medium" : "text-muted"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <select value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Weeks shown">
              {RANGES.map((r) => (
                <option key={r} value={r}>Last {r} weeks</option>
              ))}
            </select>
            <button onClick={() => setShowTable((v) => !v)} className="rounded-md border border-border px-3 py-1.5">
              {showTable ? "Show chart" : "Show table"}
            </button>
          </div>
        </div>

        {showTable ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-1.5 font-medium">Week of</th>
                <th className="py-1.5 text-right font-medium">Raid gold</th>
                <th className="py-1.5 text-right font-medium">Other gold</th>
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...weeks].reverse().map((week) => (
                <tr key={week.week} className="border-b border-border last:border-b-0">
                  <td className="py-1.5">{week.week}</td>
                  <td className="py-1.5 text-right">{formatGold(week.raid_gold)}</td>
                  <td className="py-1.5 text-right">{formatGold(week.other_gold)}</td>
                  <td className="py-1.5 text-right font-medium">{formatGold(week.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <WeeklyGoldChart weeks={weeks} show={VIEWS[view].show} />
        )}
      </section>

      <section className="overflow-x-auto rounded-md border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">By character</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-1.5 font-medium">Character</th>
              <th className="py-1.5 text-right font-medium">This week</th>
              <th className="py-1.5 text-right font-medium">Weekly average</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {characterRows.map((row) => (
              <tr key={row.name} className="border-b border-border last:border-b-0">
                <td className="py-1.5">{row.name}</td>
                <td className="py-1.5 text-right">{formatGold(row.thisWeek)}</td>
                <td className="py-1.5 text-right">{formatGold(row.average)}</td>
              </tr>
            ))}
            {characterRows.length === 0 && (
              <tr><td className="py-2 text-muted">No gold yet.</td></tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Raid clears plus gold you logged for a specific character. Gold logged for &quot;Any character&quot; shows
          as Unassigned.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="mb-3 font-semibold">This week by source</h2>
          <ul className="space-y-1.5 text-sm">
            {thisWeek && thisWeek.raid_gold > 0 && (
              <li className="flex justify-between"><span>Raids</span><span className="tabular-nums">{formatGold(thisWeek.raid_gold)}</span></li>
            )}
            {Object.entries(thisWeek?.by_source ?? {})
              .sort(([, a], [, b]) => b - a)
              .map(([source, amount]) => (
                <li key={source} className="flex justify-between"><span>{source}</span><span className="tabular-nums">{formatGold(amount)}</span></li>
              ))}
            {!thisWeek?.total && <li className="text-muted">Nothing yet this week.</li>}
          </ul>
        </section>

        <section className="overflow-x-auto rounded-md border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Recent entries</h2>
          <table className="w-full text-sm">
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-b-0">
                  <td className="py-1.5 pr-3 text-muted">{parseUtc(entry.earned_at).toLocaleDateString()}</td>
                  <td className="py-1.5 pr-3">{entry.source}</td>
                  <td className="py-1.5 pr-3 text-muted">{characterName(entry.character_id)}</td>
                  <td className="py-1.5 pr-3 text-muted">{entry.note}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatGold(entry.amount)}</td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => mutate(() => send("DELETE", `/gold-entries/${entry.id}`))}
                      className="rounded px-1.5 text-danger hover:bg-danger/10"
                      aria-label={`Delete ${entry.source} entry`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td className="py-2 text-muted">No gold logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{formatGold(value)}</div>
    </div>
  );
}

function AddGoldForm({ characters, onAdd }: { characters: Character[]; onAdd: (data: object) => Promise<void> }) {
  const [source, setSource] = useState(SOURCES[0]);
  const [customSource, setCustomSource] = useState("");
  const [amount, setAmount] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [day, setDay] = useState(todayInputValue);
  const [note, setNote] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Today means "now"; a past day is logged at local noon of that day.
    const earnedAt = day === todayInputValue() ? undefined : new Date(`${day}T12:00:00`).toISOString();
    await onAdd({
      source: source === OTHER ? customSource.trim() : source,
      amount: Number(amount),
      character_id: characterId ? Number(characterId) : null,
      note: note.trim() || null,
      earned_at: earnedAt,
    });
    setAmount("");
    setNote("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">Log gold</h2>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
        {source === OTHER && (
          <input required placeholder="Source" value={customSource} onChange={(e) => setCustomSource(e.target.value)} />
        )}
        <input
          required
          type="number"
          min="1"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32"
        />
        <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} aria-label="Character">
          <option value="">Any character</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="date" value={day} max={todayInputValue()} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
          Add
        </button>
      </div>
    </form>
  );
}
