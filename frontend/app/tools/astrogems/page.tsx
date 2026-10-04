"use client";

import { ArrowLeft, Gem, RefreshCw, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import AstrogemOdds from "@/components/tools/AstrogemOdds";
import GuideLink from "@/components/guides/GuideLink";
import { useUndo } from "@/components/Toast";
import { formatGold, send } from "@/lib/api";
import { Advice, advise, applyOption, attemptCost, canAppear, createSolver, goalMet, Goal, resultGrade, simulateRest, total } from "@/lib/astrogems";
import { applied, finish, newSession, optionsWith, parseOdds, refreshed, Session, sessionTotals, undo } from "@/lib/astrogemSession";
import { BUILT_IN_GRADES, Grade, RESULT_GRADES, StatKey, STATS } from "@/lib/data/astrogems";
import { usePreference } from "@/lib/usePreference";

const GRADES = Object.keys(BUILT_IN_GRADES) as Grade[];
const ADVICE_TEXT: Record<Advice["action"], string> = {
  "stop-done": "Stop: your goal is met. Finish processing.",
  process: "Process",
  refresh: "Refresh the options",
  "stop-hopeless": "Stop: your goal can't be reached. Finish now to save gold (fusion fodder).",
};

function parseSession(raw: string, fallback: () => Session): Session {
  try {
    const s = JSON.parse(raw) as Session;
    return s && s.gem && s.gem.levels ? s : fallback();
  } catch {
    return fallback();
  }
}

const pct = (p: number) => `${(p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0)}%`;

export default function AstrogemsPage() {
  const [oddsRaw, setOddsRaw] = usePreference<string>("astrogem-odds", "");
  const odds = useMemo(() => parseOdds(oddsRaw), [oddsRaw]);
  const options = useMemo(() => optionsWith(odds), [odds]);
  const [sessionRaw, setSessionRaw] = usePreference<string>("astrogem-session", "");
  const session = parseSession(sessionRaw, () => newSession("epic", odds));
  const save = (next: Session) => setSessionRaw(JSON.stringify(next));
  const [goalRaw, setGoalRaw] = usePreference<string>("astrogem-goal", JSON.stringify({ total: 16, min: {} }));
  const goal: Goal = useMemo(() => {
    try {
      const g = JSON.parse(goalRaw) as Goal;
      return { total: Number(g.total) || 16, min: g.min ?? {} };
    } catch {
      return { total: 16, min: {} };
    }
  }, [goalRaw]);
  const setGoal = (g: Goal) => setGoalRaw(JSON.stringify(g));
  const offerUndo = useUndo();

  const solver = useMemo(() => createSolver(options, goal, 64), [options, goal]);
  const gem = session.gem;
  const shownOptions = session.shown.map((key) => options.find((o) => o.key === key)!).filter(Boolean);
  // The game always has more than 4 options that can appear, so a turn shows exactly 4.
  const turnReady = shownOptions.length === 4;

  // The first answer for a new goal takes a moment; work it out after painting.
  const [result, setResult] = useState<{ key: string; chance: number; advice: Advice | null; rest: ReturnType<typeof simulateRest> } | null>(null);
  const resultKey = JSON.stringify([gem, session.shown, goal, odds]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const chance = solver.beforeShown(gem);
      const advice = turnReady ? advise(solver, gem, shownOptions, goal) : null;
      // Only the gold comes from the simulation; the chance shown is the solver's (less noisy).
      const rest = simulateRest(solver, options, gem, goal, odds.baseCost, 1000);
      setResult({ key: resultKey, chance, advice, rest });
    }, 0);
    return () => clearTimeout(timer);
    // resultKey covers everything the calculation reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey, solver]);
  const fresh = result?.key === resultKey ? result : null;

  function setLevel(stat: StatKey, level: number) {
    save({ ...session, history: [], gem: { ...gem, levels: { ...gem.levels, [stat]: level } } });
  }
  const setGem = (change: Partial<typeof gem>) => save({ ...session, gem: { ...gem, ...change } });

  function pickOption(key: string) {
    if (session.shown.includes(key)) save({ ...session, shown: session.shown.filter((k) => k !== key) });
    else if (session.shown.length < 4) save({ ...session, shown: [...session.shown, key] });
  }

  function applySlot(index: number) {
    const option = shownOptions[index];
    if (option) save(applied(session, option, applyOption, odds.baseCost));
  }

  function newGemOf(grade: Grade) {
    save({ ...newSession(grade, odds), finished: session.finished, logged: session.logged });
  }

  async function logSpending() {
    const { unlogged, gems } = sessionTotals(session);
    if (!unlogged) return;
    const entry = await send<{ id: number }>("POST", "/spending", { category: "gems", amount: unlogged, note: `Astrogem processing (${gems} gems)` });
    save({ ...session, logged: session.logged + unlogged });
    offerUndo(`${formatGold(unlogged)} astrogem spending logged`, async () => {
      await send("DELETE", `/spending/${entry.id}`);
    });
  }

  // Keyboard: 1-4 = that option was applied, r = refresh used, u = undo, f = finish gem.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.ctrlKey || event.metaKey || event.altKey || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (/^[1-4]$/.test(event.key)) applySlot(Number(event.key) - 1);
      else if (event.key === "r") save(refreshed(session));
      else if (event.key === "u") save(undo(session));
      else if (event.key === "f") save(finish(session, odds));
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const points = total(gem);
  const totals = sessionTotals(session);
  const advice = fresh?.advice;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/tools" className="mb-1 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={14} /> Tools
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gem size={22} /> Astrogem cutting
          </h1>
          <GuideLink id="maxroll-ark-grid" label="Ark Grid guide" />
        </div>
        <p className="text-sm text-muted">
          Keep this next to the game while you process a gem: enter the 4 options it shows, and it says whether to process,
          refresh or stop. Estimates from the official odds; tip: press Win + ← / → to snap this window beside the game.
        </p>
      </div>

      <section className="grid gap-4 rounded-md border border-border bg-surface p-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            New gem:
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => newGemOf(g)}
                className={`rounded-md border px-2.5 py-1 ${session.grade === g ? "border-accent bg-accent/15" : "border-border hover:bg-surface-2"}`}
              >
                {BUILT_IN_GRADES[g].label}
              </button>
            ))}
          </div>
          {STATS.map((stat) => (
            <div key={stat.key} className="flex items-center gap-2 text-sm">
              <span className="w-24 text-muted">{stat.short}</span>
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setLevel(stat.key, level)}
                  aria-label={`${stat.label} ${level}`}
                  aria-pressed={gem.levels[stat.key] === level}
                  className={`h-8 w-8 rounded-md border text-sm font-medium ${
                    gem.levels[stat.key] === level ? "border-accent bg-accent text-background" : level < gem.levels[stat.key] ? "border-accent/40 bg-accent/15" : "border-border"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              Attempts left
              <input type="number" min={0} max={20} value={gem.attemptsLeft} onChange={(e) => setGem({ attemptsLeft: Math.max(0, Number(e.target.value)) })} className="w-14 text-right" aria-label="Attempts left" />
            </label>
            <label className="flex items-center gap-1">
              Refreshes
              <input type="number" min={0} max={20} value={gem.refreshesLeft} onChange={(e) => setGem({ refreshesLeft: Math.max(0, Number(e.target.value)) })} className="w-14 text-right" aria-label="Refreshes left" />
            </label>
            <select value={gem.costStep} onChange={(e) => setGem({ costStep: Number(e.target.value) })} aria-label="Cost modifier">
              <option value={-1}>Cost −100%</option>
              <option value={0}>Normal cost</option>
              <option value={1}>Cost +100%</option>
            </select>
          </div>
          <p className="text-sm">
            Total <span className="font-semibold">{points}</span> ({resultGrade(points, RESULT_GRADES)}) · next attempt{" "}
            {formatGold(attemptCost(gem, odds.baseCost))} gold · spent {formatGold(session.gold)}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Options on screen (click to add, up to 4)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 1, 2, 3].map((slot) => {
              const option = shownOptions[slot];
              return (
                <button
                  key={slot}
                  onClick={() => applySlot(slot)}
                  disabled={!option}
                  title={option ? "This one was applied" : undefined}
                  className="flex min-h-12 flex-col items-start rounded-md border border-border px-2 py-1 text-left text-sm hover:border-accent disabled:opacity-50"
                >
                  <span className="text-xs text-muted">{slot + 1}</span>
                  <span className="font-medium">{option?.label ?? "—"}</span>
                  {option && advice && <span className="text-xs text-muted">then {pct(advice.after[slot])} to reach goal</span>}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">Processed? Click the option the game applied (or press 1–4). Each is 25%.</p>
          <div className="flex flex-wrap gap-1.5 text-sm">
            <button onClick={() => save(refreshed(session))} disabled={gem.refreshesLeft <= 0} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 hover:bg-surface-2 disabled:opacity-50">
              <RefreshCw size={13} /> Used a refresh (r)
            </button>
            <button onClick={() => save(undo(session))} disabled={!session.history.length} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 hover:bg-surface-2 disabled:opacity-50">
              <Undo2 size={13} /> Undo (u)
            </button>
            <button onClick={() => save({ ...session, shown: [] })} disabled={!session.shown.length} className="rounded-md border border-border px-2.5 py-1 hover:bg-surface-2 disabled:opacity-50">
              Clear options
            </button>
            <button onClick={() => save(finish(session, odds))} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 hover:bg-surface-2">
              <RotateCcw size={13} /> Finish gem (f)
            </button>
          </div>
        </div>

        <div className="rounded-md border border-accent/40 bg-accent/10 p-3 md:col-span-2" aria-live="polite">
          {!fresh ? (
            <p className="text-sm text-muted">Working out the odds…</p>
          ) : goalMet(gem, goal) ? (
            <p className="text-lg font-semibold">{ADVICE_TEXT["stop-done"]}</p>
          ) : advice ? (
            <>
              <p className="text-lg font-semibold">{ADVICE_TEXT[advice.action]}</p>
              <p className="text-sm">
                Chance to reach your goal: process {pct(advice.processChance)}
                {advice.refreshChance !== null && <> · refresh {pct(advice.refreshChance)}</>}
              </p>
            </>
          ) : (
            <p className="text-sm">
              Enter the options the game shows to get advice. Before seeing them: {pct(fresh.chance)} to reach your goal.
            </p>
          )}
          {fresh && !goalMet(gem, goal) && gem.attemptsLeft > 0 && (
            <p className="mt-1 text-xs text-muted">
              Following the advice to the end costs about {formatGold(Math.round(fresh.rest.averageGold))} more gold (unlucky:{" "}
              {formatGold(fresh.rest.unluckyGold)}).
            </p>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Add an option on screen</p>
        <div className="flex flex-wrap gap-1">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => pickOption(o.key)}
              // Options the game can't show for this gem (e.g. "-1" at level 1) are greyed out.
              disabled={!session.shown.includes(o.key) && !canAppear(o, gem)}
              aria-pressed={session.shown.includes(o.key)}
              className={`rounded border px-2 py-0.5 text-xs disabled:opacity-30 ${session.shown.includes(o.key) ? "border-accent bg-accent/15" : "border-border hover:bg-surface-2"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-4 text-sm">
          <p className="mb-2 font-medium">Your goal</p>
          <label className="mb-2 flex items-center gap-2">
            Total points at least
            <input type="number" min={4} max={20} value={goal.total} onChange={(e) => setGoal({ ...goal, total: Number(e.target.value) })} className="w-16 text-right" aria-label="Goal total points" />
            <span className="text-xs text-muted">(16 Relic, 19 Ancient)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {STATS.map((stat) => (
              <label key={stat.key} className="flex items-center gap-1">
                {stat.short} ≥
                <select
                  value={goal.min[stat.key] ?? 0}
                  onChange={(e) => setGoal({ ...goal, min: { ...goal.min, [stat.key]: Number(e.target.value) || undefined } })}
                  aria-label={`Minimum ${stat.label}`}
                >
                  <option value={0}>any</option>
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-4 text-sm">
          <p className="mb-2 font-medium">This session</p>
          {session.finished.length === 0 ? (
            <p className="text-muted">Finished gems show here.</p>
          ) : (
            <>
              <p>
                Cut {totals.gems} gem{totals.gems === 1 ? "" : "s"}, spent {formatGold(totals.gold)} gold ·{" "}
                {RESULT_GRADES.map((g) => `${session.finished.filter((f) => f.grade === g.label).length} ${g.label}`).join(", ")}
              </p>
              <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-muted">
                {[...session.finished].reverse().map((f, i) => (
                  <li key={i}>
                    {f.points} points ({f.grade}) · {STATS.map((s) => f.levels[s.key]).join("/")} · {formatGold(f.gold)} gold
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <button onClick={logSpending} disabled={!totals.unlogged} className="rounded-md border border-border px-2.5 py-1 hover:bg-surface-2 disabled:opacity-50">
                  Log {formatGold(totals.unlogged)} as spending
                </button>
                <button onClick={() => save({ ...session, finished: [], logged: 0 })} className="rounded-md border border-border px-2.5 py-1 hover:bg-surface-2">
                  Clear session
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <AstrogemOdds raw={oddsRaw} odds={odds} onChange={setOddsRaw} />
    </div>
  );
}
