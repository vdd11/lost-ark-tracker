"use client";

import { ArrowLeft, Hammer, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import { PageSkeleton } from "@/components/Skeleton";
import GuideLink from "@/components/guides/GuideLink";
import NumberInput from "@/components/NumberInput";
import { useUndo } from "@/components/Toast";
import HoningStepsEditor from "@/components/tools/HoningStepsEditor";
import { api, API_URL, byPosition, Character, formatGold, send, WeeklyGold } from "@/lib/api";
import {
  averageIncome,
  BOUND_MODES,
  BoundMode,
  CostSummary,
  forecastPlan,
  HoningPlan,
  UnitPrices,
  weeksToAfford,
} from "@/lib/honing";
import { Price } from "@/lib/prices";
import { formatItemLevel } from "@/lib/raids";

type SavedPlan = {
  character_id: number;
  start_item_level: number;
  target_item_level: number | null;
  notes: string | null;
  plan: HoningPlan;
  bound_mode: BoundMode;
  updated_at: string;
};

type Draft = { target: string; notes: string; plan: HoningPlan; boundMode: BoundMode };

// Honing spends the character's bound gold, then roster-bound, then tradeable (per the user, 2026-10-04).
const EMPTY: Draft = { target: "", notes: "", plan: { steps: [], owned: {} }, boundMode: "all" };
const INCOME_WEEKS = 9; // 8 finished weeks plus the current one

function draftOf(saved: SavedPlan | undefined): Draft {
  if (!saved) return EMPTY;
  return {
    target: saved.target_item_level == null ? "" : String(saved.target_item_level),
    notes: saved.notes ?? "",
    plan: saved.plan,
    boundMode: saved.bound_mode,
  };
}

const weeksText = (weeks: number | null) =>
  weeks == null ? "never at this income" : weeks === 0 ? "already covered" : weeks < 1 ? "this week" : `~${Math.ceil(weeks)} weeks`;

export default function HoningPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [incomeByAccount, setIncomeByAccount] = useState<Record<number, WeeklyGold[]>>({});
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [extraWeekly, setExtraWeekly] = useState(0);
  const [logAmount, setLogAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Until the first load finishes (or fails), show a skeleton instead of empty states.
  const [loaded, setLoaded] = useState(false);
  const offerUndo = useUndo();

  const load = useCallback(() => {
    Promise.all([api<Character[]>("/characters"), api<Price[]>("/prices"), api<SavedPlan[]>("/honing-plans")])
      .then(([characterData, priceData, planData]) => {
        setCharacters(characterData.sort(byPosition));
        setPrices(priceData);
        setPlans(planData);
        setError(null);
        setLoaded(true);
      })
      .catch((e) => {
        setError(describeError(e));
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const character = characters.find((c) => c.id === characterId) ?? characters[0] ?? null;
  const saved = plans.find((p) => p.character_id === character?.id);

  // Weekly income for each account that has a plan or is selected.
  const accountIds = useMemo(() => {
    const ids = new Set(plans.map((p) => characters.find((c) => c.id === p.character_id)?.account_id));
    if (character) ids.add(character.account_id);
    return [...ids].filter((id): id is number => id != null).sort().join(",");
  }, [plans, characters, character]);

  useEffect(() => {
    if (!accountIds) return;
    Promise.all(
      accountIds.split(",").map((id) => api<WeeklyGold[]>(`/gold/weekly?weeks=${INCOME_WEEKS}&account_id=${id}`).then((weeks) => [Number(id), weeks] as const)),
    )
      .then((entries) => setIncomeByAccount(Object.fromEntries(entries)))
      .catch((e) => setError(describeError(e)));
  }, [accountIds]);

  function choose(id: number) {
    setCharacterId(id);
    setDraft(draftOf(plans.find((p) => p.character_id === id)));
    setDirty(false);
  }

  // Show the saved plan when the page loads or the character changes, unless there are unsaved edits.
  const [shownFor, setShownFor] = useState<number | null>(null);
  if (character && shownFor !== character.id && !dirty) {
    setShownFor(character.id);
    setDraft(draftOf(saved));
  }

  const edit = (change: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...change }));
    setDirty(true);
  };

  const unitPrices: UnitPrices = useMemo(() => Object.fromEntries(prices.map((p) => [p.key, p.unit_price])), [prices]);
  const forecast = useMemo(() => forecastPlan(draft.plan, unitPrices), [draft.plan, unitPrices]);
  const income = character ? averageIncome(incomeByAccount[character.account_id] ?? [], character.id) : null;
  const weeks = (cost: CostSummary) => (income ? weeksToAfford(cost, income, draft.boundMode, undefined, extraWeekly) : null);

  async function save() {
    if (!character) return;
    try {
      await send("PUT", `/honing-plans/${character.id}`, {
        target_item_level: draft.target ? Number(draft.target) : null,
        notes: draft.notes,
        plan: draft.plan,
        bound_mode: draft.boundMode,
      });
      setDirty(false);
      load();
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function remove() {
    if (!character || !saved) return;
    try {
      await send("DELETE", `/honing-plans/${character.id}`);
      setDraft(EMPTY);
      setDirty(false);
      load();
      offerUndo(`${character.name}'s honing plan deleted`, async () => {
        await send("PUT", `/honing-plans/${character.id}`, {
          target_item_level: saved.target_item_level,
          notes: saved.notes,
          plan: saved.plan,
          bound_mode: saved.bound_mode,
        });
        setShownFor(null);
        load();
      });
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function logSpending() {
    if (!character || !Number(logAmount)) return;
    try {
      const entry = await send<{ id: number }>("POST", "/spending", {
        category: "honing",
        amount: Number(logAmount),
        character_id: character.id,
        note: "Honing plan",
      });
      setLogAmount("");
      offerUndo(`${formatGold(Number(logAmount))} honing logged for ${character.name}`, () => send("DELETE", `/spending/${entry.id}`));
    } catch (e) {
      setError(describeError(e));
    }
  }

  // Every saved plan, for "which alt gets there first", simulated like the plan above.
  const savedCosts = useMemo(
    () => new Map(plans.map((p) => [p.character_id, forecastPlan(p.plan, unitPrices).median])),
    [plans, unitPrices],
  );
  const comparison = plans
    .map((p) => {
      const who = characters.find((c) => c.id === p.character_id);
      const cost = savedCosts.get(p.character_id);
      if (!who || !cost) return null;
      const accountIncome = averageIncome(incomeByAccount[who.account_id] ?? [], who.id);
      return { who, plan: p, cost, weeks: weeksToAfford(cost, accountIncome, p.bound_mode, undefined, extraWeekly) };
    })
    .filter((row) => row !== null)
    .sort((a, b) => (a.weeks ?? Infinity) - (b.weeks ?? Infinity));

  const nameOf = (key: string) => prices.find((p) => p.key === key)?.name ?? key;

  if (!loaded) return <PageSkeleton title="Honing planner" />;

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div>
        <Link href="/tools" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={14} /> Tools
        </Link>
        <div className="mb-1 flex flex-wrap items-baseline gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Hammer size={22} /> Honing planner
          </h1>
          <GuideLink id="maxroll-honing" label="How honing works" />
          {plans.length > 0 && (
            <a href={`${API_URL}/export/honing-plans.csv`} download className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
              Export plans (CSV)
            </a>
          )}
        </div>
        <p className="text-sm text-muted">
          How much gold a target item level costs, as a range, and how many weeks your own income needs to pay for it.
          Fill in each upgrade with the numbers your in-game honing panel shows (chance, any increase per failure or
          guaranteed attempt, and the cost per try): nothing about honing is built in, because the rules change with
          patches. Materials are valued at your <Link href="/tools/prices" className="underline">Prices</Link>.
        </p>
      </div>

      {characters.length === 0 ? (
        <p className="text-sm text-muted">Add a character in Settings first.</p>
      ) : (
        <>
          <section className="space-y-3 rounded-md border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select value={character?.id ?? ""} onChange={(e) => choose(Number(e.target.value))} aria-label="Character">
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({formatItemLevel(c.item_level)}){plans.some((p) => p.character_id === c.id) ? " · plan" : ""}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5">
                Target item level
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={draft.target}
                  onChange={(e) => edit({ target: e.target.value })}
                  aria-label="Target item level"
                  className="w-24 text-right"
                />
              </label>
              <select value={draft.boundMode} onChange={(e) => edit({ boundMode: e.target.value as BoundMode })} aria-label="Gold that pays for it">
                {BOUND_MODES.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <span className="ml-auto flex gap-2">
                <button
                  onClick={save}
                  disabled={!dirty && !!saved}
                  className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 font-medium text-background disabled:opacity-50"
                >
                  <Save size={14} /> {saved ? (dirty ? "Save changes" : "Saved") : "Save plan"}
                </button>
                {saved && (
                  <button onClick={remove} aria-label="Delete plan" className="rounded-md border border-border px-2 py-1.5 text-muted hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </div>
            <input
              value={draft.notes}
              onChange={(e) => edit({ notes: e.target.value })}
              placeholder="Notes (optional), e.g. weapon first, then armor to +15"
              aria-label="Plan notes"
              maxLength={1000}
              className="w-full text-sm"
            />
            <HoningStepsEditor plan={draft.plan} prices={prices} onChange={(plan) => edit({ plan })} />
          </section>

          {draft.plan.steps.length > 0 && (
            <section className="space-y-3 rounded-md border border-border bg-surface p-4">
              <h2 className="font-semibold">What it costs</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["Good luck", "1 in 10 do better", forecast.lucky],
                    ["Typical", "half do better", forecast.median],
                    ["Unlucky", "9 in 10 do better", forecast.unlucky],
                  ] as const
                ).map(([label, hint, cost]) => (
                  <div key={label} className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted">
                      {label} <span className="text-muted/70">({hint})</span>
                    </p>
                    <p className="text-xl font-semibold tabular-nums">{formatGold(Math.round(cost.total))}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {formatGold(Math.round(cost.buyGold))} on materials · {formatGold(Math.round(cost.feeGold))} in fees ·{" "}
                      {formatGold(Math.round(cost.silver))} silver
                    </p>
                    <p className="mt-1 text-sm">{weeksText(weeks(cost))}</p>
                  </div>
                ))}
              </div>
              <ul className="text-sm text-muted">
                {forecast.expected.map((e) => {
                  const step = draft.plan.steps.find((s) => s.id === e.id);
                  return (
                    <li key={e.id}>
                      {step?.label || "Unnamed step"}: {e.neverSucceeds ? <span className="text-danger">can never succeed with these numbers</span> : `${e.attempts.toFixed(2)} tries on average`}
                      {step && step.count > 1 ? `, ×${step.count}` : ""}
                    </li>
                  );
                })}
                {Object.entries(forecast.averageMaterials).map(([key, amount]) => (
                  <li key={key}>
                    {nameOf(key)}: about {formatGold(Math.round(amount))} needed, {formatGold(draft.plan.owned[key] ?? 0)} owned
                  </li>
                ))}
              </ul>
              {forecast.unpriced.length > 0 && (
                <p className="text-sm text-accent">
                  No price yet for {forecast.unpriced.map(nameOf).join(", ")}: not counted. Set it in{" "}
                  <Link href="/tools/prices" className="underline">Prices</Link>.
                </p>
              )}
              <p className="text-xs text-muted">
                An estimate from the numbers above, simulated {forecast.samples.toLocaleString()} times with a fixed seed so
                it doesn&apos;t change between visits. Materials you already have count as free and are used first; the
                rest is bought at your prices with tradeable gold (bound materials from dailies and raids belong in
                &ldquo;already have&rdquo;). If you could sell what you own instead, the real cost is higher.
              </p>
            </section>
          )}

          {character && draft.plan.steps.length > 0 && (
            <section className="space-y-3 rounded-md border border-border bg-surface p-4 text-sm">
              <h2 className="font-semibold">Weeks to pay for it</h2>
              {income && (
                <p className="text-muted">
                  Your average over the last {INCOME_WEEKS - 1} finished weeks{characters.length > 1 ? ` on ${character.name}'s account` : ""}:{" "}
                  {formatGold(Math.round(income.tradeable))} tradeable, {formatGold(Math.round(income.rosterBound))} roster-bound and{" "}
                  {formatGold(Math.round(income.characterBound))} {character.name}-bound gold a week (after bonus chests). Buying materials
                  on the market takes tradeable gold; honing fees use {character.name}&apos;s bound gold first, then
                  roster-bound, then tradeable (narrow it with &ldquo;{BOUND_MODES.find((m) => m.key === draft.boundMode)?.label}&rdquo;).
                </p>
              )}
              <label className="flex flex-wrap items-center gap-2">
                What if you earned
                <input
                  type="range"
                  min={0}
                  max={300000}
                  step={5000}
                  value={extraWeekly}
                  onChange={(e) => setExtraWeekly(Number(e.target.value))}
                  aria-label="Extra gold per week"
                  className="w-48"
                />
                <span className="tabular-nums">{formatGold(extraWeekly)}</span> more a week? Typical: {weeksText(weeks(forecast.median))}.
              </label>
              <p className="text-muted">
                More gold earners or better raids? <Link href="/settings" className="underline">Suggest my gold setup</Link> in Settings.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span>Honed? Log what you spent so the Gold page stays right:</span>
                <NumberInput value={logAmount} onChange={setLogAmount} placeholder="Gold" aria-label="Gold spent on honing" className="w-32" />
                <button onClick={logSpending} disabled={!Number(logAmount)} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50">
                  Log this honing
                </button>
              </div>
            </section>
          )}

          {comparison.length > 1 && (
            <section className="rounded-md border border-border bg-surface p-4 text-sm">
              <h2 className="mb-2 font-semibold">Which character gets there first</h2>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 font-medium">Character</th>
                    <th className="py-1 font-medium">Goal</th>
                    <th className="py-1 text-right font-medium">Typical cost</th>
                    <th className="py-1 text-right font-medium">Weeks</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(({ who, plan, cost, weeks: w }) => (
                    <tr key={who.id} className="border-t border-border">
                      <td className="py-1">
                        <button onClick={() => choose(who.id)} className="hover:text-accent hover:underline">{who.name}</button>
                      </td>
                      <td className="py-1 text-muted">
                        {formatItemLevel(who.item_level)} → {plan.target_item_level ? formatItemLevel(plan.target_item_level) : "?"}
                      </td>
                      <td className="py-1 text-right tabular-nums">{formatGold(Math.round(cost.total))}</td>
                      <td className="py-1 text-right">{weeksText(w)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
