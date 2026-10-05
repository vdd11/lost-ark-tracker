"use client";

import { Advice, attemptCost, canAppear, resultGrade, total } from "@/lib/astrogems";
import { Session } from "@/lib/astrogemSession";
import { EFFECTS, EffectKey, GEM_TYPES, ProcessingOption, RESULT_GRADES, StatKey } from "@/lib/data/astrogems";
import { formatGold } from "@/lib/api";

const pct = (p: number) => `${(p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0)}%`;

/** One corner of the gem: a coloured badge with the stat's name, level and (for effects) which effect. */
function Node({
  stat,
  label,
  tone,
  session,
  onLevel,
  effect,
}: {
  stat: StatKey;
  label: string;
  tone: string;
  session: Session;
  onLevel: (stat: StatKey, level: number) => void;
  effect?: { value: EffectKey | null; choices: EffectKey[]; onChange: (e: EffectKey | null) => void; label: string };
}) {
  const level = session.gem.levels[stat];
  return (
    <div className={`flex w-full max-w-40 flex-col items-center gap-1 rounded-lg border-2 bg-surface px-2 py-1.5 text-center ${tone}`}>
      <span className="text-xs font-medium leading-tight text-muted">{label}</span>
      <select
        value={level}
        onChange={(e) => onLevel(stat, Number(e.target.value))}
        aria-label={`${label} level`}
        className="w-16 py-0.5 text-center text-lg font-semibold tabular-nums"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      {effect && (
        <select
          value={effect.value ?? ""}
          onChange={(e) => effect.onChange((e.target.value || null) as EffectKey | null)}
          aria-label={effect.label}
          className="w-full truncate py-0.5 text-xs"
        >
          <option value="">Which effect?</option>
          {effect.choices.map((key) => (
            <option key={key} value={key}>{EFFECTS[key]}</option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * The cutting screen, laid out like the game's: gem type on top, Willpower
 * Efficiency and Order/Chaos Points above and below the gem, the two effects
 * either side, then attempts, refreshes and cost, then the 4 options offered.
 * Original artwork; nothing from the game client.
 */
export default function AstrogemPanel({
  session,
  options,
  baseCost,
  advice,
  save,
  onApply,
}: {
  session: Session;
  options: ProcessingOption[];
  baseCost: number;
  /** Advice for the 4 options on screen, once all 4 are entered. */
  advice: Advice | null;
  save: (next: Session) => void;
  /** The game applied the option in this slot. */
  onApply: (slot: number) => void;
}) {
  const gem = session.gem;
  const type = GEM_TYPES.find((t) => t.key === session.gemType) ?? null;
  const effects = session.effects ?? [null, null];
  const choices = type?.effects ?? (Object.keys(EFFECTS) as EffectKey[]);
  const points = total(gem);
  const pointsLabel = type ? `${type.family} Points` : "Order / Chaos Points";

  const setLevel = (stat: StatKey, level: number) => save({ ...session, gem: { ...gem, levels: { ...gem.levels, [stat]: level } } });
  const setEffect = (index: 0 | 1) => (value: EffectKey | null) => {
    const next: [EffectKey | null, EffectKey | null] = [...effects];
    next[index] = value;
    save({ ...session, effects: next });
  };
  // Slot n is the nth option on the game's screen; empty slots are "" until filled.
  const setSlot = (slot: number, key: string) => {
    const shown = [0, 1, 2, 3].map((i) => (i === slot ? key : (session.shown[i] ?? "")));
    while (shown.length && shown[shown.length - 1] === "") shown.pop();
    save({ ...session, shown });
  };

  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Astrogem</span>
        <select
          value={session.gemType ?? ""}
          onChange={(e) => save({ ...session, gemType: e.target.value || undefined, effects: [null, null] })}
          aria-label="Astrogem type"
          className="min-w-56"
        >
          <option value="">Choose the gem type…</option>
          {(["Order", "Chaos"] as const).map((family) => (
            <optgroup key={family} label={family}>
              {GEM_TYPES.filter((t) => t.family === family).map((t) => (
                <option key={t.key} value={t.key}>
                  {family} · {t.name} ({t.willpower} willpower)
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* The gem: willpower on top, points below, effects either side. */}
      <div className="grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_auto_auto] items-center justify-items-center gap-2">
        <div className="col-start-2 row-start-1">
          <Node stat="willpower" label="Willpower Efficiency" tone="border-danger/60" session={session} onLevel={setLevel} />
        </div>
        <div className="col-start-1 row-start-2 w-full justify-self-end">
          <Node
            stat="effect1"
            label="Effect 1"
            tone="border-done/60"
            session={session}
            onLevel={setLevel}
            effect={{ value: effects[0], choices, onChange: setEffect(0), label: "First effect" }}
          />
        </div>
        <svg viewBox="0 0 100 100" className="col-start-2 row-start-2 h-24 w-24" role="img" aria-label={`Total ${points} points, ${resultGrade(points, RESULT_GRADES)}`}>
          <polygon points="50,4 96,50 50,96 4,50" className="fill-surface-2 stroke-accent" strokeWidth="3" />
          <polygon points="50,18 82,50 50,82 18,50" className="fill-accent/15 stroke-accent/40" strokeWidth="1.5" />
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[22px] font-semibold tabular-nums">
            {points}
          </text>
          <text x="50" y="70" textAnchor="middle" className="fill-muted text-[9px]">
            {resultGrade(points, RESULT_GRADES)}
          </text>
        </svg>
        <div className="col-start-3 row-start-2 w-full justify-self-start">
          <Node
            stat="effect2"
            label="Effect 2"
            tone="border-series-1/70"
            session={session}
            onLevel={setLevel}
            effect={{ value: effects[1], choices, onChange: setEffect(1), label: "Second effect" }}
          />
        </div>
        <div className="col-start-2 row-start-3">
          <Node stat="points" label={pointsLabel} tone="border-accent/70" session={session} onLevel={setLevel} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <label className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <span className="text-xs text-muted">Attempts</span>
          <select value={gem.attemptsLeft} onChange={(e) => save({ ...session, gem: { ...gem, attemptsLeft: Number(e.target.value) } })} aria-label="Attempts left" className="border-0 py-0 tabular-nums">
            {Array.from({ length: 13 }, (_, n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <span className="text-xs text-muted">Refreshes</span>
          <select value={gem.refreshesLeft} onChange={(e) => save({ ...session, gem: { ...gem, refreshesLeft: Number(e.target.value) } })} aria-label="Refreshes left" className="border-0 py-0 tabular-nums">
            {Array.from({ length: 11 }, (_, n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <span className="text-xs text-muted">Cost</span>
          <select value={gem.costStep} onChange={(e) => save({ ...session, gem: { ...gem, costStep: Number(e.target.value) } })} aria-label="Cost modifier" className="border-0 py-0">
            <option value={-1}>−100% (free)</option>
            <option value={0}>Normal</option>
            <option value={1}>+100%</option>
          </select>
        </label>
        <span className="text-xs text-muted tabular-nums">next {formatGold(attemptCost(gem, baseCost))} · spent {formatGold(session.gold)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((slot) => {
          const key = session.shown[slot] ?? "";
          const option = options.find((o) => o.key === key);
          return (
            <div key={slot} className="flex flex-col gap-1 rounded-md border border-border p-1.5">
              <select
                value={key}
                onChange={(e) => setSlot(slot, e.target.value)}
                aria-label={`Option ${slot + 1} offered`}
                className="w-full py-1 text-sm"
              >
                <option value="">Option {slot + 1}…</option>
                {options.map((o) => (
                  <option
                    key={o.key}
                    value={o.key}
                    // Options this gem can't be offered, or already in another slot, can't be picked.
                    disabled={o.key !== key && (!canAppear(o, gem) || session.shown.includes(o.key))}
                  >
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onApply(slot)}
                disabled={!option}
                title="The game applied this one"
                className="rounded border border-border px-1 py-1 text-xs hover:border-accent disabled:opacity-40"
              >
                Applied ({slot + 1})
                {option && advice ? <span className="block text-xs text-muted">then {pct(advice.after[slot])}</span> : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
