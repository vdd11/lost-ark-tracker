"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import StackedWeeklyChart, { ChartSeries } from "@/components/StackedWeeklyChart";
import { api, byPosition, Character, formatGold, GemEntry, parseUtc, send, WeeklyGems } from "@/lib/api";

// Fixed order and colors; anything else folds into "Other".
const SOURCES = ["Ebony Cube", "Guardian Raid", "Field Boss"];
const OTHER = "Other";
const SERIES: ChartSeries[] = [
  { key: "Ebony Cube", label: "Ebony Cube", color: "var(--series-1)" },
  { key: "Guardian Raid", label: "Guardian Raid", color: "var(--series-2)" },
  { key: "Field Boss", label: "Field Boss", color: "var(--series-3)" },
  { key: OTHER, label: OTHER, color: "var(--series-4)" },
];
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
const RANGES = [8, 12, 26, 52];

function todayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Group sources outside the fixed list into "Other" so colors never shift. */
function bySeries(bySource: Record<string, number>) {
  const values: Record<string, number> = {};
  for (const [source, amount] of Object.entries(bySource)) {
    const key = SOURCES.includes(source) ? source : OTHER;
    values[key] = (values[key] ?? 0) + amount;
  }
  return values;
}

function describeGems(gems: Record<string, number>) {
  return Object.entries(gems)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, count]) => `${count}× Lv${level}`)
    .join(", ");
}

export default function GemsPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entries, setEntries] = useState<GemEntry[]>([]);
  const [weeks, setWeeks] = useState<WeeklyGems[]>([]);
  const [range, setRange] = useState(12);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api<Character[]>("/characters"),
      api<GemEntry[]>("/gem-entries?limit=50"),
      api<WeeklyGems[]>(`/gems/weekly?weeks=${range}`),
    ])
      .then(([characterData, entryData, weekData]) => {
        setCharacters(characterData.sort(byPosition));
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Gems</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Log the gems you get to see how many you generate each week. Totals are in level-1 equivalents: three of a
          level combine into one of the next, so a Lv2 counts as 3 and a Lv3 as 9.
        </p>
      </div>
      <ErrorBanner error={error} />

      <AddGemsForm characters={characters} onAdd={(data) => mutate(() => send("POST", "/gem-entries", data))} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="This week" value={thisWeek?.total ?? 0} accent />
        <Tile label="Last week" value={lastWeek?.total ?? 0} />
        <Tile label={`Average, last ${range} weeks`} value={average} />
      </div>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Weekly gems (Lv1 equivalents)</h2>
          <div className="flex items-center gap-2 text-sm">
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
                {SERIES.map((s) => (
                  <th key={s.key} className="py-1.5 text-right font-medium">{s.label}</th>
                ))}
                <th className="py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...weeks].reverse().map((week) => {
                const values = bySeries(week.by_source);
                return (
                  <tr key={week.week} className="border-b border-border last:border-b-0">
                    <td className="py-1.5">{week.week}</td>
                    {SERIES.map((s) => (
                      <td key={s.key} className="py-1.5 text-right">{formatGold(values[s.key] ?? 0)}</td>
                    ))}
                    <td className="py-1.5 text-right font-medium">{formatGold(week.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <StackedWeeklyChart
            label="Weekly gems in level-1 equivalents"
            series={SERIES}
            weeks={weeks.map((week) => ({
              week: week.week,
              values: bySeries(week.by_source),
              details: Object.entries(week.by_level).map(([level, count]) => [`Lv${level} gems`, count]),
            }))}
          />
        )}
      </section>

      <section className="overflow-x-auto rounded-md border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">Recent drops</h2>
        <table className="w-full text-sm">
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border last:border-b-0">
                <td className="py-1.5 pr-3 text-muted">{parseUtc(entry.earned_at).toLocaleDateString()}</td>
                <td className="py-1.5 pr-3">{entry.source}</td>
                <td className="py-1.5 pr-3 text-muted">{characterName(entry.character_id)}</td>
                <td className="py-1.5 pr-3">{describeGems(entry.gems)}</td>
                <td className="py-1.5 pr-3 text-muted">{entry.note}</td>
                <td className="py-1.5 text-right">
                  <button
                    onClick={() => mutate(() => send("DELETE", `/gem-entries/${entry.id}`))}
                    className="rounded px-1.5 text-danger hover:bg-danger/10"
                    aria-label={`Delete ${entry.source} entry`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td className="py-2 text-muted">No gems logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
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

function AddGemsForm({ characters, onAdd }: { characters: Character[]; onAdd: (data: object) => Promise<void> }) {
  const [source, setSource] = useState(SOURCES[0]);
  const [customSource, setCustomSource] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [day, setDay] = useState(todayInputValue);
  const [note, setNote] = useState("");
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [showHighLevels, setShowHighLevels] = useState(false);

  const total = LEVELS.reduce((sum, level) => sum + (Number(counts[level]) || 0) * 3 ** (level - 1), 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const gems = Object.fromEntries(
      LEVELS.map((level) => [level, Math.max(0, Math.round(Number(counts[level]) || 0))]).filter(([, count]) => count > 0),
    );
    // Today means "now"; a past day is logged at local noon of that day.
    const earnedAt = day === todayInputValue() ? undefined : new Date(`${day}T12:00:00`).toISOString();
    await onAdd({
      source: source === OTHER ? customSource.trim() || OTHER : source,
      character_id: characterId ? Number(characterId) : null,
      gems,
      note: note.trim() || null,
      earned_at: earnedAt,
    });
    setCounts({});
    setNote("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border bg-surface p-4 text-sm">
      <h2 className="font-semibold">Log gems</h2>
      <div className="flex flex-wrap items-end gap-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
        {source === OTHER && (
          <input placeholder="Source" value={customSource} onChange={(e) => setCustomSource(e.target.value)} />
        )}
        <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} aria-label="Character">
          <option value="">Any character</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="date" value={day} max={todayInputValue()} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {LEVELS.filter((level) => showHighLevels || level <= 5).map((level) => (
          <label key={level} className="flex flex-col gap-1 text-xs text-muted">
            Lv{level}
            <input
              type="number"
              min="0"
              placeholder="0"
              value={counts[level] ?? ""}
              onChange={(e) => setCounts({ ...counts, [level]: e.target.value })}
              className="w-16 text-sm text-foreground"
            />
          </label>
        ))}
        <button type="button" onClick={() => setShowHighLevels((v) => !v)} className="px-1 py-1.5 text-xs text-muted underline">
          {showHighLevels ? "Fewer levels" : "Lv6–10"}
        </button>
        <button type="submit" disabled={total === 0} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-40">
          Add
        </button>
        {total > 0 && <span className="pb-1.5 text-xs text-muted">= {formatGold(total)} Lv1 equivalents</span>}
      </div>
    </form>
  );
}
