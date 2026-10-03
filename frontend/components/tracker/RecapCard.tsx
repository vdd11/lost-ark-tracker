import { Check, Coins, Gem, History, Swords, TrendingDown, TrendingUp, X } from "lucide-react";
import { ReactNode } from "react";

import { Character, formatCombinedGems, formatGold, WeeklyGems, WeeklyGold } from "@/lib/api";
import { percentChange } from "@/lib/insights";

/**
 * Last week at a glance, shown once after the Wednesday reset: gold against
 * the week before, gems, and gold raids that were left unrun.
 */
export default function RecapCard({
  week,
  gold,
  previousGold,
  gems,
  missed,
  onDismiss,
}: {
  /** Start of last week's reset period. */
  week: string;
  gold: WeeklyGold | undefined;
  previousGold: WeeklyGold | undefined;
  gems: WeeklyGems | undefined;
  missed: { character: Character; missed: number }[];
  onDismiss: () => void;
}) {
  const change = gold && previousGold ? percentChange(previousGold.net, gold.net) : null;
  const totalMissed = missed.reduce((sum, row) => sum + row.missed, 0);
  const start = new Date(`${week}T00:00:00`);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const range = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <section className="rounded-lg border border-accent/40 bg-surface p-4" aria-label="Last week's recap">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-accent">
            <History size={18} />
          </span>
          <div>
            <h2 className="font-semibold leading-tight">New week! Here&apos;s last week</h2>
            <p className="text-xs text-muted">{range}</p>
          </div>
        </div>
        <button onClick={onDismiss} aria-label="Hide until next week" title="Hide until next week" className="rounded-md p-1 text-muted hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Fact icon={<Coins size={14} />} label="Gold earned">
          <span className="text-lg font-semibold tabular-nums">{formatGold(gold?.net ?? 0)}</span>
          {change !== null && (
            <span className={`ml-2 inline-flex items-center gap-0.5 text-xs font-medium ${change >= 0 ? "text-done" : "text-danger"}`}>
              {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change > 0 ? "+" : ""}
              {change}% vs the week before
            </span>
          )}
        </Fact>
        <Fact icon={<Gem size={14} />} label="Gems">
          <span className="text-sm font-medium">{gems && gems.total > 0 ? formatCombinedGems(gems.total) : "None tracked"}</span>
        </Fact>
        <Fact icon={<Swords size={14} />} label="Gold raids">
          {totalMissed === 0 ? (
            <span className="flex items-center gap-1 text-sm font-medium text-done">
              <Check size={14} /> Every gold raid done
            </span>
          ) : (
            <span className="text-sm">
              <span className="font-medium text-accent">{totalMissed} missed</span>
              <span className="text-muted">
                {" · "}
                {missed.map((row) => `${row.character.name} ${row.missed}`).join(", ")}
              </span>
            </span>
          )}
        </Fact>
      </div>
    </section>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-surface-2/60 px-3 py-2">
      <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
