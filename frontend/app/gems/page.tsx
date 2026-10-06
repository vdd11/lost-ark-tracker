"use client";

import { Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import AccountTabs, { useAccountChoice } from "@/components/AccountTabs";
import { PageSkeleton } from "@/components/Skeleton";
import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import { useUndo } from "@/components/Toast";
import StackedWeeklyChart, { ChartSeries } from "@/components/StackedWeeklyChart";
import {
  Account,
  api,
  API_URL,
  byPosition,
  Character,
  Difficulty,
  formatCombinedGems,
  formatGems,
  GemEntry,
  GemTable,
  GemTableField,
  gemsToLv1,
  parseUtc,
  send,
  Task,
  WeeklyGems,
} from "@/lib/api";
import { formatItemLevel } from "@/lib/raids";
import { gemEntryBody } from "@/lib/undo";
import { usePreference } from "@/lib/usePreference";
import CharacterName from "@/components/CharacterName";

// Fixed order and colors; anything else folds into "Other". Ebony Cube and
// Haal's Hourglass are filled in from the tracker, the rest are logged here.
const TRACKED = ["Ebony Cube", "Haal's Hourglass"];
const SOURCES = ["Guardian Raid", "Field Boss", "Chaos Gate"];
const OTHER = "Other";
const SERIES: ChartSeries[] = [
  { key: "Ebony Cube", label: "Ebony Cube", color: "var(--series-1)" },
  { key: "Haal's Hourglass", label: "Haal's Hourglass", color: "var(--series-2)" },
  { key: "Guardian Raid", label: "Guardian Raid", color: "var(--series-3)" },
  { key: "Field Boss", label: "Field Boss", color: "var(--series-4)" },
  { key: "Chaos Gate", label: "Chaos Gate", color: "var(--danger)" },
  { key: OTHER, label: OTHER, color: "var(--series-5)" },
];
const KNOWN_SOURCES = [...TRACKED, ...SOURCES];
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
    const key = KNOWN_SOURCES.includes(source) ? source : OTHER;
    values[key] = (values[key] ?? 0) + amount;
  }
  return values;
}

function describeGems(gems: Record<string, number>) {
  return Object.entries(gems)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, count]) => `${formatGems(count)}× Lv${level}`)
    .join(", ");
}

export default function GemsPage() {
  const [allCharacters, setCharacters] = useState<Character[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useAccountChoice(accounts);
  const accountQuery = accountId ? `&account_id=${accountId}` : "";
  const characters = accountId ? allCharacters.filter((c) => c.account_id === accountId) : allCharacters;
  const [entries, setEntries] = useState<GemEntry[]>([]);
  const [weeks, setWeeks] = useState<WeeklyGems[]>([]);
  const [rewardTasks, setRewardTasks] = useState<Task[]>([]);
  const [range, setRange] = usePreference("gems-range", 12, RANGES);
  const [showTable, setShowTable] = usePreference<boolean>("gems-table", false);
  const [error, setError] = useState<string | null>(null);
  // Until the first load finishes (or fails), show a skeleton instead of empty states.
  const [loaded, setLoaded] = useState(false);
  const offerUndo = useUndo();

  const load = useCallback(() => {
    Promise.all([
      api<Character[]>("/characters"),
      api<GemEntry[]>(`/gem-entries?limit=50${accountQuery}`),
      api<WeeklyGems[]>(`/gems/weekly?weeks=${range}${accountQuery}`),
      api<Task[]>("/tasks"),
      api<Account[]>("/accounts"),
    ])
      .then(([characterData, entryData, weekData, taskData, accountData]) => {
        setCharacters(characterData.sort(byPosition));
        setAccounts(accountData);
        setEntries(entryData);
        setWeeks(weekData);
        setRewardTasks(taskData.filter((t) => t.category !== "raid" && t.difficulties.length > 0).sort(byPosition));
        setError(null);
        setLoaded(true);
      })
      .catch((e) => {
        setError(describeError(e));
        setLoaded(true);
      });
  }, [range, accountQuery]);

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
  const average = weeks.length ? weeks.reduce((sum, w) => sum + w.total, 0) / weeks.length : 0;
  // Per character: this week and the weekly average over the shown range.
  const characterRows = [...characters.map((c) => c.name), "Unassigned"]
    .map((name) => ({
      name,
      thisWeek: thisWeek?.by_character[name] ?? 0,
      average: weeks.reduce((sum, w) => sum + (w.by_character[name] ?? 0), 0) / Math.max(1, weeks.length),
    }))
    .filter((row) => row.thisWeek > 0 || row.average > 0);

  if (!loaded) return <PageSkeleton title="Gems" />;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Gems</h1>
          <AccountTabs accounts={accounts} value={accountId} onChange={setAccountId} />
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Gems from Ebony Cube and Haal&apos;s Hourglass are added from the tracker using the reward table below. Log
          everything else (Guardian Raids, Field Bosses) here. Totals show what your gems combine into: three of a
          level make one of the next, so 15 Lv1 gems are a Lv3 + 2× Lv2.
        </p>
      </div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      <AddGemsForm characters={characters} onAdd={(data) => mutate(() => send("POST", "/gem-entries", data))} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="This week" value={thisWeek?.total ?? 0} accent />
        <Tile label="Last week" value={lastWeek?.total ?? 0} />
        <Tile label={`Average a week, last ${range} weeks`} value={average} />
      </div>

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold" title="Bar height counts every gem as Lv1 gems (a Lv2 is 3, a Lv3 is 9)">
            Weekly gems
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <select value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Weeks shown">
              {RANGES.map((r) => (
                <option key={r} value={r}>Last {r} weeks</option>
              ))}
            </select>
            <button onClick={() => setShowTable(!showTable)} className="rounded-md border border-border px-3 py-1.5">
              {showTable ? "Show chart" : "Show table"}
            </button>
            <a href={`${API_URL}/export/gems.csv`} download className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
              Export CSV
            </a>
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
                      <td key={s.key} className="py-1.5 text-right">{values[s.key] ? formatCombinedGems(values[s.key]) : "–"}</td>
                    ))}
                    <td className="py-1.5 text-right font-medium">{formatCombinedGems(week.total)}</td>
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
                <td className="py-1.5">
                  <CharacterName name={row.name} className={characters.find((c) => c.name === row.name)?.class_name} />
                </td>
                <td className="py-1.5 text-right">{formatCombinedGems(row.thisWeek)}</td>
                <td className="py-1.5 text-right">{formatCombinedGems(row.average)}</td>
              </tr>
            ))}
            {characterRows.length === 0 && (
              <tr><td className="py-2 text-muted">Nothing yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <RewardTables tasks={rewardTasks} mutate={mutate} />

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
                    onClick={() =>
                      mutate(async () => {
                        await send("DELETE", `/gem-entries/${entry.id}`);
                        offerUndo(`Deleted the ${entry.source} gems`, async () => {
                          await send("POST", "/gem-entries", gemEntryBody(entry));
                          load();
                        });
                      })
                    }
                    className="rounded px-1.5 text-danger hover:bg-danger/10"
                    aria-label={`Delete ${entry.source} entry`}
                  >
                    <Trash2 size={14} />
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

/** A gem total shown as what it combines into, with the Lv1 count underneath. */
function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{formatCombinedGems(value)}</div>
      <div className="text-xs text-muted">{formatGems(value)} Lv1 gems&apos; worth</div>
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
          <optgroup label="Usually tracked automatically">
            {TRACKED.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </optgroup>
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
        {total > 0 && <span className="pb-1.5 text-xs text-muted">= {formatCombinedGems(total)}</span>}
      </div>
    </form>
  );
}

const TABLE_ROWS: { field: GemTableField; label: string }[] = [
  { field: "reward_gems", label: "Per run" },
  { field: "lucky_gems", label: "Lucky room" },
  { field: "mega_gems", label: "Mega lucky room" },
];
const TABLE_LEVELS = [1, 2, 3, 4, 5];

/** Expected gems per tier, used to turn tracked runs into gems. */
function RewardTables({ tasks, mutate }: { tasks: Task[]; mutate: (action: () => Promise<unknown>) => void }) {
  return (
    <section className="space-y-4 rounded-md border border-border bg-surface p-4">
      <div>
        <h2 className="font-semibold">Reward tables</h2>
        <p className="mt-1 text-xs text-muted">
          Gems for each tier, by gem level. Per-run values are multiplied by Cube runs, or by Sands of Trial for
          Haal&apos;s Hourglass (1 + sands); a lucky room adds its tier&apos;s amount once per room. Known values come with
          app updates. Where one isn&apos;t known yet (–), you can enter what you get; a later update replaces it.
        </p>
      </div>
      {tasks.map((task) => (
        <div key={task.id} className="overflow-x-auto">
          <h3 className="mb-1 text-sm font-medium">{task.name}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 pr-2 font-medium">Tier</th>
                <th className="py-1 pr-2 font-medium" />
                {TABLE_LEVELS.map((level) => (
                  <th key={level} className="py-1 pr-2 font-medium">Lv{level}</th>
                ))}
                <th className="py-1 pr-2 text-right font-medium">Combines into</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {task.difficulties.map((tier) =>
                TABLE_ROWS.map((row, index) => (
                  <GemTableRow
                    key={`${tier.id}-${row.field}-${JSON.stringify(tier[row.field])}`}
                    tier={tier}
                    showTier={index === 0}
                    label={row.label}
                    table={tier[row.field]}
                    catalogTable={tier.catalog_rewards?.[row.field] ?? null}
                    onSave={(table) => mutate(() => send("PATCH", `/difficulties/${tier.id}`, { [row.field]: table }))}
                  />
                )),
              )}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

function GemTableRow({
  tier,
  showTier,
  label,
  table,
  catalogTable,
  onSave,
}: {
  tier: Difficulty;
  showTier: boolean;
  label: string;
  table: GemTable | null;
  catalogTable: GemTable | null;
  onSave: (table: GemTable | null) => void;
}) {
  const [draft, setDraft] = useState<Record<number, string>>(() =>
    Object.fromEntries(TABLE_LEVELS.map((level) => [level, table?.[level] ? String(table[level]) : ""])),
  );
  // The app's value when it has one; otherwise the user can fill it in.
  const known = catalogTable !== null;

  function save() {
    const next: GemTable = {};
    for (const level of TABLE_LEVELS) {
      const value = Number(draft[level]);
      if (draft[level].trim() !== "" && Number.isFinite(value) && value > 0) next[level] = value;
    }
    // Keep levels above Lv5 that came from elsewhere.
    for (const [level, count] of Object.entries(table ?? {})) {
      if (Number(level) > TABLE_LEVELS.length) next[Number(level)] = count;
    }
    const result = Object.keys(next).length ? next : null;
    if (JSON.stringify(result) !== JSON.stringify(table ?? null)) onSave(result);
  }

  return (
    <tr className={showTier ? "border-t border-border" : ""}>
      <td className="py-1 pr-2 align-top font-medium">
        {showTier && (
          <>
            {tier.name} <span className="text-xs font-normal text-muted">{formatItemLevel(tier.min_item_level)}</span>
          </>
        )}
      </td>
      <td className="whitespace-nowrap py-1 pr-2 text-xs text-muted">{label}</td>
      {TABLE_LEVELS.map((level) => (
        <td key={level} className="py-1 pr-2">
          {known ? (
            <span className="inline-block w-16 px-1.5 py-0.5 tabular-nums">{table?.[level] ?? "–"}</span>
          ) : (
          <input
            type="number"
            min="0"
            step="any"
            placeholder="–"
            value={draft[level]}
            onChange={(e) => setDraft({ ...draft, [level]: e.target.value })}
            onBlur={save}
            aria-label={`${tier.name} ${label} Lv${level} gems`}
            title="Not known yet: enter what you get"
            className="w-16 px-1.5 py-0.5"
          />
          )}
        </td>
      ))}
      <td className="py-1 pr-2 text-right tabular-nums text-muted">{table ? formatCombinedGems(gemsToLv1(table)) : "?"}</td>
      <td className="py-1 text-right text-xs text-muted">{!known && table ? "yours" : ""}</td>
    </tr>
  );
}
