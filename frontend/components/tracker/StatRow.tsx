import { Coins, Swords, Wallet } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import { describeError } from "@/components/ErrorBanner";
import QuickGold from "@/components/QuickGold";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { formatGold } from "@/lib/api";
import { raidGoldSplit } from "@/lib/goldEarners";
import { goldRaidsLeft, possibleRaidGold } from "@/lib/raids";
import { STAT_KEYS } from "@/lib/trackerView";

// Static class names so Tailwind generates them: the row fits however many boxes are shown.
const STAT_COLUMNS = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5"];

/** The boxes along the top of the tracker, each of which can be hidden in Customize. */
export default function StatRow({ data, view }: { data: TrackerData; view: TrackerView }) {
  const { thisWeek, characters, tasks, runs } = data;
  if (!thisWeek) return null;
  const possibleGold = possibleRaidGold(characters, tasks, runs);
  const raidsLeft = goldRaidsLeft(characters, tasks, runs);
  const split = raidGoldSplit(thisWeek);

  const stats = [
    {
      key: STAT_KEYS.raidsLeft,
      node: (
        <Stat
          icon={<Swords size={16} />}
          label="Gold raids left"
          value={String(raidsLeft.left)}
          sub={
            raidsLeft.slots === 0
              ? "no gold earners with raids"
              : `of ${raidsLeft.slots} this week${raidsLeft.events ? ` · +${raidsLeft.events} event` : ""}`
          }
          title="Each gold earner is paid for 3 raids a week; event raids pay once per account"
          accent={raidsLeft.left > 0}
        />
      ),
    },
    {
      key: STAT_KEYS.raidGold,
      node: (
        <Stat
          icon={<Coins size={16} />}
          label="Raid gold this week"
          value={formatGold(split.shared)}
          sub={
            <>
              <span className="block">
                {split.characterBound > 0
                  ? `+ ${formatGold(split.characterBound)} bound to ${split.spreadOver} character${split.spreadOver === 1 ? "" : "s"}`
                  : "tradeable + roster-bound"}
              </span>
              <span className="block">of {formatGold(possibleGold)} possible</span>
            </>
          }
          title="Tradeable and roster-bound raid gold, which any character can spend; character-bound gold only its own character can use"
        />
      ),
    },
    {
      key: STAT_KEYS.otherGold,
      node: (
        <Stat
          icon={<Coins size={16} />}
          label="Other gold this week"
          value={formatGold(thisWeek.other_gold)}
          sub={
            <span className="flex items-center gap-2">
              <QuickGold
                accountId={data.accountId || null}
                onLogged={data.loadWeeklyGold}
                onError={(e) => data.setError(describeError(e))}
              />
              <Link href="/gold" className="underline">Gold page</Link>
            </span>
          }
        />
      ),
    },
    {
      key: STAT_KEYS.total,
      node: (
        <Stat
          icon={<Wallet size={16} />}
          label="Total this week"
          value={formatGold(thisWeek.net)}
          sub={thisWeek.bonus_spent > 0 ? `after ${formatGold(thisWeek.bonus_spent)} on bonus boxes` : undefined}
          accent
        />
      ),
    },
    {
      key: STAT_KEYS.leftToUse,
      node: (
        <Stat
          icon={<Wallet size={16} />}
          label="Left to use"
          value={formatGold(thisWeek.tradeable_left)}
          sub={`tradeable · ${formatGold(thisWeek.roster_bound_left)} roster-bound`}
          title="After bonus boxes, which use character-bound gold first, then roster-bound, then tradeable"
        />
      ),
    },
  ].filter((stat) => view.isShown(stat.key));

  if (stats.length === 0) return null;
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${STAT_COLUMNS[stats.length]}`}>
      {stats.map((stat) => (
        <div key={stat.key}>{stat.node}</div>
      ))}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  accent,
  title,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: boolean;
  title?: string;
}) {
  return (
    <div className="h-full rounded-lg border border-border bg-surface px-4 py-3" title={title}>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</div>
      {/* Two lines are always reserved, so a longer line after a tick doesn't grow the row and move the cards. */}
      <div className="line-clamp-2 min-h-8 text-xs text-muted">{sub}</div>
    </div>
  );
}
