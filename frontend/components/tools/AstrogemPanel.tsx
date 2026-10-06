"use client";

import { RefreshCw } from "lucide-react";

import GameIcon from "@/components/GameIcon";
import { formatGold } from "@/lib/api";
import { Advice, attemptCost, canAppear, resultGrade, total } from "@/lib/astrogems";
import { Session } from "@/lib/astrogemSession";
import { astrogemIconName } from "@/lib/data/icons";
import {
  BUILT_IN_GRADES,
  EFFECTS,
  EffectKey,
  GEM_TYPES,
  Grade,
  ProcessingOption,
  RESULT_GRADES,
  StatKey,
} from "@/lib/data/astrogems";

const pct = (p: number) => `${(p * 100).toFixed(p > 0 && p < 0.1 ? 1 : 0)}%`;
const GRADES = Object.keys(BUILT_IN_GRADES) as Grade[];

/** Each corner's colour, like the game's: willpower red, effects green and blue, points gold. */
const TONES: Record<StatKey, { fill: string; text: string }> = {
  willpower: { fill: "#d2493f", text: "text-[#ff8a7a]" },
  effect1: { fill: "#45a85a", text: "text-[#7fdc8f]" },
  effect2: { fill: "#3b82d6", text: "text-[#82b8ff]" },
  points: { fill: "#d99a2b", text: "text-[#f3c66b]" },
};

/** A faceted diamond (our own drawing), filled with a stat's colour; grey when empty. */
function Diamond({ fill, size = 52 }: { fill: string | null; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="shrink-0">
      <polygon points="50,2 98,50 50,98 2,50" fill="#c9a96a" opacity={fill ? 0.9 : 0.35} />
      <polygon points="50,12 88,50 50,88 12,50" fill={fill ?? "#4a4f5a"} stroke="#1b1f27" strokeWidth="2" />
      <polygon points="50,12 88,50 50,50" fill="#fff" opacity="0.18" />
      <polygon points="12,50 50,88 50,50" fill="#000" opacity="0.15" />
    </svg>
  );
}

/** Which corner an option changes, for its little diamond. */
function optionTone(option: ProcessingOption | undefined): string | null {
  if (!option) return null;
  const effect = option.effect;
  if (effect.kind === "stat") return TONES[effect.stat].fill;
  if (effect.kind === "changeEffect") return TONES[effect.which === 1 ? "effect1" : "effect2"].fill;
  return "#8b8f99";
}

/** One corner of the gem: its diamond, name (or effect picker) and a level badge. */
function Node({
  stat,
  label,
  session,
  onLevel,
  effect,
}: {
  stat: StatKey;
  label: string;
  session: Session;
  onLevel: (stat: StatKey, level: number) => void;
  effect?: { value: EffectKey | null; choices: EffectKey[]; onChange: (e: EffectKey | null) => void; label: string };
}) {
  const level = session.gem.levels[stat];
  const tone = TONES[stat];
  return (
    <div className="flex w-36 flex-col items-center gap-1 text-center">
      <Diamond fill={tone.fill} />
      {effect ? (
        <select
          value={effect.value ?? ""}
          onChange={(e) => effect.onChange((e.target.value || null) as EffectKey | null)}
          aria-label={effect.label}
          className={`field-sizing-content max-w-full truncate border-transparent bg-transparent px-1 py-0 text-sm font-medium ${tone.text}`}
        >
          <option value="">{label}?</option>
          {effect.choices.map((key) => (
            <option key={key} value={key}>{EFFECTS[key]}</option>
          ))}
        </select>
      ) : (
        <span className={`text-sm font-medium leading-tight ${tone.text}`}>{label}</span>
      )}
      <select
        value={level}
        onChange={(e) => onLevel(stat, Number(e.target.value))}
        aria-label={`${effect?.value ? EFFECTS[effect.value] : label} level`}
        className="rounded border-[#8a7444] bg-[#2a2418] px-1.5 py-0 text-center text-sm font-semibold tabular-nums text-[#f3d58e]"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{effect ? `Lv. ${n}` : n}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * The cutting screen, laid out like the game's Processing window: grade and
 * gem type on top, the gem's four corners around a dial (Willpower
 * Efficiency above, the two effects either side, Order/Chaos Points below),
 * then the four options offered, the processing cost and attempts. Original
 * artwork; only item icons come from the game (see public/game-icons).
 */
export default function AstrogemPanel({
  session,
  options,
  baseCost,
  maxAttempts,
  maxRefreshes,
  advice,
  save,
  onApply,
  onNewGem,
  onRefresh,
}: {
  session: Session;
  options: ProcessingOption[];
  baseCost: number;
  /** A new gem's attempts and refreshes at this grade. */
  maxAttempts: number;
  maxRefreshes: number;
  /** Advice for the 4 options on screen, once all 4 are entered. */
  advice: Advice | null;
  save: (next: Session) => void;
  /** The game applied the option in this slot. */
  onApply: (slot: number) => void;
  onNewGem: (grade: Grade) => void;
  onRefresh: () => void;
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
    <div className="game-window @container rounded-xl p-1">
      <div className="rounded-lg border border-[#5c4d31] px-3 pb-3 pt-2 sm:px-4">
        <h2 className="mb-2 text-center font-serif text-xl font-semibold tracking-wide text-[#efe3c2]">Processing</h2>

        <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2/60 px-2 py-1.5 text-sm">
          <span className="mr-1 text-xs uppercase tracking-wide text-muted">New gem</span>
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => onNewGem(g)}
              aria-pressed={session.grade === g}
              className={`rounded border px-2 py-0.5 ${session.grade === g ? "border-accent bg-accent/20 text-foreground" : "border-border text-muted hover:text-foreground"}`}
            >
              {BUILT_IN_GRADES[g].label} ({BUILT_IN_GRADES[g].attempts})
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1">
          <label className="flex items-center gap-2">
            <GameIcon name={type ? astrogemIconName(type.key) : "astrogem-order"} size={36} alt="" />
            <select
              value={session.gemType ?? ""}
              onChange={(e) => save({ ...session, gemType: e.target.value || undefined, effects: [null, null] })}
              aria-label="Astrogem type"
              className={`font-semibold ${type?.family === "Chaos" ? "text-[#c99bff]" : type ? "text-[#ff9d8a]" : ""}`}
            >
              <option value="">Choose the gem type…</option>
              {(["Order", "Chaos"] as const).map((family) => (
                <optgroup key={family} label={`${family} Astrogem`}>
                  {GEM_TYPES.filter((t) => t.family === family).map((t) => (
                    <option key={t.key} value={t.key}>
                      {family}: {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <p className="text-sm text-foreground" aria-label={`Total ${points} points, ${resultGrade(points, RESULT_GRADES)}`}>
            {points} Astrogem Points <span className="text-muted">· {resultGrade(points, RESULT_GRADES)}</span>
            {type && <span className="text-muted"> · {type.willpower} willpower</span>}
          </p>
          <div className="mt-1 flex w-full max-w-72 items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={gem.refreshesLeft <= 0}
              title="You used a refresh in game (r): the 4 options are replaced"
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-border bg-surface-2 py-1 text-sm hover:border-accent disabled:opacity-50"
            >
              <RefreshCw size={13} /> Refresh ({gem.refreshesLeft}/{maxRefreshes})
            </button>
            <select
              value={gem.refreshesLeft}
              onChange={(e) => save({ ...session, gem: { ...gem, refreshesLeft: Number(e.target.value) } })}
              aria-label="Refreshes left"
              title="Refreshes left"
              className="py-0.5 text-sm tabular-nums"
            >
              {Array.from({ length: Math.max(maxRefreshes + 4, gem.refreshesLeft) + 1 }, (_, n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* The dial: willpower on top, points below, the two effects either side. */}
        <div className="relative mx-auto my-3 grid max-w-md grid-cols-3 grid-rows-[auto_auto_auto] place-items-center">
          <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 m-auto h-full max-h-72 w-full" aria-hidden>
            <circle cx="150" cy="150" r="104" fill="none" stroke="#7d8495" strokeWidth="1.5" strokeDasharray="5 7" opacity="0.6" />
            <circle cx="150" cy="150" r="70" fill="none" stroke="#7d8495" strokeWidth="1" opacity="0.5" />
          </svg>
          <div className="relative col-start-2 row-start-1">
            <Node stat="willpower" label="Willpower Efficiency" session={session} onLevel={setLevel} />
          </div>
          <div className="relative col-start-1 row-start-2">
            <Node stat="effect1" label="Effect 1" session={session} onLevel={setLevel} effect={{ value: effects[0], choices, onChange: setEffect(0), label: "First effect" }} />
          </div>
          <div className="relative col-start-3 row-start-2">
            <Node stat="effect2" label="Effect 2" session={session} onLevel={setLevel} effect={{ value: effects[1], choices, onChange: setEffect(1), label: "Second effect" }} />
          </div>
          <div className="relative col-start-2 row-start-3">
            <Node stat="points" label={pointsLabel} session={session} onLevel={setLevel} />
          </div>
        </div>

        <div className="border-t border-border pt-2">
          <p className="mb-2 text-center text-sm text-foreground">One of the following is randomly applied.</p>
          <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
            {[0, 1, 2, 3].map((slot) => {
              const key = session.shown[slot] ?? "";
              const option = options.find((o) => o.key === key);
              return (
                <div key={slot} className="flex flex-col items-center gap-1 rounded-md border border-border bg-surface-2/50 p-1.5">
                  <Diamond fill={optionTone(option)} size={28} />
                  <select
                    value={key}
                    onChange={(e) => setSlot(slot, e.target.value)}
                    aria-label={`Option ${slot + 1} offered`}
                    className="w-full py-0.5 text-center text-xs"
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
                    className="w-full rounded border border-border px-1 py-0.5 text-xs hover:border-accent disabled:opacity-40"
                  >
                    Applied ({slot + 1})
                    {/* Always takes its line, so the cards don't grow when the advice arrives. */}
                    <span className="block text-xs text-muted">{option && advice ? `then ${pct(advice.after[slot])}` : "\u00a0"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <dl className="mt-3 space-y-1 border-t border-border pt-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt>Processing cost</dt>
            <dd className="flex items-center gap-1.5 tabular-nums">
              <select
                value={gem.costStep}
                onChange={(e) => save({ ...session, gem: { ...gem, costStep: Number(e.target.value) } })}
                aria-label="Cost modifier"
                className="py-0 text-xs"
              >
                <option value={-1}>−100%</option>
                <option value={0}>Normal</option>
                <option value={1}>+100%</option>
              </select>
              {formatGold(attemptCost(gem, baseCost))}
              <GameIcon name="gold" size={18} alt="gold" />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2 text-muted">
            <dt>Spent on this gem so far</dt>
            <dd className="flex items-center gap-1.5 tabular-nums">
              {formatGold(session.gold)}
              <GameIcon name="gold" size={18} alt="gold" />
            </dd>
          </div>
        </dl>

        <label className="mt-3 flex items-center justify-center gap-2 rounded-md border border-border bg-surface-2 py-1.5 text-sm">
          Process
          <select
            value={gem.attemptsLeft}
            onChange={(e) => save({ ...session, gem: { ...gem, attemptsLeft: Number(e.target.value) } })}
            aria-label="Attempts left"
            className="py-0 tabular-nums"
          >
            {Array.from({ length: Math.max(maxAttempts, gem.attemptsLeft) + 1 }, (_, n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="tabular-nums text-muted">/ {maxAttempts} left</span>
        </label>
      </div>
    </div>
  );
}
