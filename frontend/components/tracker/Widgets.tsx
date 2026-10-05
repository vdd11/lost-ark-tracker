"use client";

import { Clock, Gem, LucideIcon, Target, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import NumberInput from "@/components/NumberInput";
import { Character, formatCombinedGems, formatGold, WeeklyGems, WeeklyGold } from "@/lib/api";
import PeriodToggle from "@/components/tracker/PeriodToggle";
import { Period, PERIODS, periodTotal } from "@/lib/periods";
import { GOAL_MODES, GoalMode, OnHand, onHandToward, weeklyToward } from "@/lib/goldGoal";
import { describeReset } from "@/lib/resetClock";
import {
  compactGold,
  dailyRate,
  daysToGoal,
  formatDuration,
  formatEta,
  gemGoal,
  percentChange,
} from "@/lib/insights";

export function Widget({ icon: Icon, title, action, children }: { icon: LucideIcon; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Icon size={16} />
          </span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Bar({ value, tone = "bg-accent" }: { value: number; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

const shortWeek = (week: string) =>
  new Date(`${week}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** The last few weeks of gold as small stacked columns, with the month's total and trend. */
export function GoldMonthWidget({
  weeks,
  period = "month",
  onPeriod,
  allWeeks = null,
}: {
  weeks: WeeklyGold[];
  period?: Period;
  onPeriod?: (period: Period) => void;
  /** Every tracked week, for "All time" (null while loading). */
  allWeeks?: WeeklyGold[] | null;
}) {
  const shown = weeks.slice(-8);
  const source = period === "all" ? (allWeeks ?? weeks) : weeks;
  const sum = periodTotal(source, period, (w) => w.net);
  const month = weeks.slice(-4).reduce((total, w) => total + w.net, 0);
  // Compare finished weeks only: the four before this one vs the four before those.
  const finished = weeks.slice(0, -1);
  const change = percentChange(
    finished.slice(-8, -4).reduce((sum, w) => sum + w.net, 0),
    finished.slice(-4).reduce((sum, w) => sum + w.net, 0),
  );
  const tallest = Math.max(1, ...shown.map((w) => w.raid_gold + w.other_gold));

  return (
    <Widget
      icon={TrendingUp}
      title="Gold"
      action={
        <span className="flex items-center gap-2">
          {onPeriod && <PeriodToggle value={period} onChange={onPeriod} label="Gold for" />}
          <Link href="/gold" className="text-xs text-muted underline hover:text-foreground">History</Link>
        </span>
      }
    >
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{formatGold(sum.total)}</span>
        {period === "month" && change !== null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-medium ${change >= 0 ? "text-done" : "text-danger"}`}
            title="Last 4 finished weeks vs the 4 before"
          >
            {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {change > 0 ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">
        {period === "week"
          ? "this week so far, after bonus boxes"
          : period === "month"
            ? `last 4 weeks, after bonus boxes · about ${compactGold(month / 4)} a week`
            : allWeeks === null
              ? "loading your history…"
              : `${sum.weeks} week${sum.weeks === 1 ? "" : "s"} tracked, after bonus boxes · about ${compactGold(sum.perWeek)} a week`}
      </p>
      <div className="mt-auto flex h-24 items-end gap-1.5" role="img" aria-label="Gold per week for the last 8 weeks">
        {shown.map((week, index) => {
          const current = index === shown.length - 1;
          const total = week.raid_gold + week.other_gold;
          return (
            <div
              key={week.week}
              className="flex h-full flex-1 flex-col justify-end"
              title={`Week of ${shortWeek(week.week)}${current ? " (so far)" : ""}: ${formatGold(total)} (raids ${formatGold(week.raid_gold)}, other ${formatGold(week.other_gold)})`}
            >
              <div className={`flex flex-col overflow-hidden rounded-t ${current ? "opacity-60" : ""}`} style={{ height: `${(total / tallest) * 100}%` }}>
                <div className="bg-series-2" style={{ flexGrow: week.other_gold }} />
                <div className="bg-series-1" style={{ flexGrow: week.raid_gold }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{shown[0] ? shortWeek(shown[0].week) : ""}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-series-1" />Raids</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-series-2" />Other</span>
        </span>
        <span>this week</span>
      </div>
    </Widget>
  );
}

/**
 * How long until a gold target at the recent pace, from what you have if
 * you've checked in. Counts tradeable and roster-bound gold only: character-
 * bound gold can't be spent on anyone else.
 */
export function GoldGoalWidget({
  weeks,
  daysIntoWeek,
  onHand,
  boundGold,
  characters,
  mode,
  onMode,
  characterId,
  onCharacter,
  goal,
  onGoal,
}: {
  weeks: WeeklyGold[];
  daysIntoWeek: number;
  /** Gold on hand by kind (last check-in plus tracked since), or null without a check-in. */
  onHand: OnHand | null;
  /** Each character's character-bound gold now (null until entered). */
  boundGold: Record<string, number | null>;
  characters: Character[];
  mode: GoalMode;
  onMode: (mode: GoalMode) => void;
  characterId: number | null;
  onCharacter: (id: number) => void;
  goal: number;
  onGoal: (goal: number) => void;
}) {
  const who = mode === "character" ? characters.find((c) => c.id === characterId) ?? characters[0] ?? null : null;
  const perDay = dailyRate(weeks.map((w) => weeklyToward(w, mode, who?.id ?? null)), daysIntoWeek);
  const balance = onHandToward(onHand, mode, who ? (boundGold[String(who.id)] ?? null) : null);
  const start = balance ?? 0;
  const days = daysToGoal(start, goal, perDay);
  const counted =
    mode === "tradeable" ? "tradeable" : mode === "roster" ? "tradeable + roster-bound" : `tradeable + roster-bound + ${who?.name ?? "their"}'s bound`;

  return (
    <Widget icon={Target} title="Gold goal">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <select value={mode} onChange={(e) => onMode(e.target.value as GoalMode)} aria-label="What counts toward the goal" className="px-1.5 py-1 text-xs">
          {GOAL_MODES.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
        {mode === "character" && characters.length > 0 && (
          <select value={who?.id ?? ""} onChange={(e) => onCharacter(Number(e.target.value))} aria-label="Character" className="px-1.5 py-1 text-xs">
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2">
          Target
          <NumberInput
            value={String(goal)}
            onChange={(digits) => onGoal(Number(digits) || 0)}
            aria-label="Gold goal"
            className="w-32 px-2 py-1 text-sm text-foreground"
          />
        </label>
      </div>
      {goal <= 0 ? (
        <p className="text-sm text-muted">Set a target to see how long it takes.</p>
      ) : days === null ? (
        <p className="text-sm text-muted">Clear a few raids or log some gold to see your pace.</p>
      ) : (
        <>
          <div className="text-2xl font-semibold">{days === 0 ? "Reached" : `~${formatDuration(days)}`}</div>
          <p className="mb-3 text-xs text-muted">
            {days === 0
              ? `You have ${formatGold(start)}.`
              : `around ${formatEta(days)}, at ${compactGold(perDay! * 7)} a week`}
          </p>
          {balance !== null ? (
            <div className="mt-auto">
              <Bar value={start / goal} tone={days === 0 ? "bg-done" : "bg-accent"} />
              <p className="mt-1 text-[11px] text-muted">
                {formatGold(start)} of {formatGold(goal)} {counted} on hand, from your last check-in
              </p>
            </div>
          ) : (
            <p className="mt-auto text-[11px] text-muted">
              Time to earn it from zero. <Link href="/gold/#check-in" className="underline">Check in</Link> your gold to count what you already have.
            </p>
          )}
        </>
      )}
    </Widget>
  );
}

/** Tracked gems (cube, hourglass, logged) projected toward the next high-level gems. */
export function GemWidget({
  weeks,
  daysIntoWeek,
  levels = [9, 10],
  period = "all",
  onPeriod,
}: {
  weeks: WeeklyGems[];
  daysIntoWeek: number;
  levels?: number[];
  period?: Period;
  onPeriod?: (period: Period) => void;
}) {
  const total = weeks.reduce((sum, w) => sum + w.total, 0);
  const gained = periodTotal(weeks, period, (w) => w.total);
  const perDay = dailyRate(weeks.map((w) => w.total), daysIntoWeek);

  return (
    <Widget
      icon={Gem}
      title="Gem progress"
      action={
        <span className="flex items-center gap-2">
          {onPeriod && <PeriodToggle value={period} onChange={onPeriod} label="Gems gained in" />}
          <Link href="/gems" className="text-xs text-muted underline hover:text-foreground">Gems</Link>
        </span>
      }
    >
      {total === 0 ? (
        <p className="text-sm text-muted">
          Run Ebony Cube or Haal&apos;s Hourglass, or log gems from Guardian Raids and Field Bosses, to see when your next
          big gem lands.
        </p>
      ) : (
        <>
          <p className="mb-1 text-sm">
            <span className="text-muted">{PERIODS.find((p) => p.key === period)?.label}: </span>
            <span className="font-medium tabular-nums">{gained.total > 0 ? formatCombinedGems(gained.total) : "none yet"}</span>
          </p>
          <p className="mb-3 text-xs text-muted">
            {perDay ? (
              <>
                About <span className="font-medium text-foreground">{formatCombinedGems(perDay * 7)}</span> a week, all
                combined
              </>
            ) : (
              "Not enough recent runs for a pace yet"
            )}
          </p>
          <ul className="mt-auto space-y-3">
            {levels.map((level) => {
              const goal = gemGoal(total, perDay, level);
              return (
                <li key={level}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      Next Lv{level}
                      {goal.earned > 0 && <span className="font-normal text-muted"> · {goal.earned} made so far</span>}
                    </span>
                    <span className="text-xs text-muted" title={goal.every ? `One every ~${formatDuration(goal.every)}` : undefined}>
                      {goal.days === null ? `${Math.round(goal.progress * 100)}%` : `~${formatDuration(goal.days)} · ${formatEta(goal.days)}`}
                    </span>
                  </div>
                  <Bar value={goal.progress} />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted">
            From every gem tracked here, as if you combined them all into one.
          </p>
        </>
      )}
    </Widget>
  );
}

/** When the next daily and weekly resets are, in your own time and in UTC. */
export function ResetClockWidget({ nextDaily, nextWeekly, now }: { nextDaily: string; nextWeekly: string; now: Date }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rows = [
    { label: "Daily reset", reset: describeReset(nextDaily, now) },
    { label: "Weekly reset", reset: describeReset(nextWeekly, now) },
  ];
  return (
    <Widget icon={Clock} title="Resets">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(({ label, reset }) => (
            <tr key={label}>
              <td className="py-1 pr-2 text-muted">{label}</td>
              <td className="py-1 pr-2 font-medium">{reset.local}</td>
              <td className="py-1 pr-2 text-xs text-muted">{reset.utc} UTC</td>
              <td className="py-1 text-right tabular-nums">in {reset.countdown}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Your time zone: {zone}.</p>
    </Widget>
  );
}
