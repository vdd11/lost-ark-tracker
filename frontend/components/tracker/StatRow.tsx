import { Coins, Swords } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import { describeError } from "@/components/ErrorBanner";
import QuickGold from "@/components/QuickGold";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { formatGold } from "@/lib/api";
import { goldThisWeek, goldThisWeekParts, raidGoldSplit } from "@/lib/goldEarners";
import { goldRaidsLeft, possibleRaidGold } from "@/lib/raids";
import { STAT_KEYS } from "@/lib/trackerView";
import GameIcon from "@/components/GameIcon";

// Static class names so Tailwind generates them: the row fits however many boxes are shown.
const STAT_COLUMNS = ["", "sm:grid-cols-1", "sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"];

/** The boxes along the top of the tracker, each of which can be hidden in Customize. */
export default function StatRow({ data, view }: { data: TrackerData; view: TrackerView }) {
  const { thisWeek, characters, tasks, runs } = data;
  if (!thisWeek) return null;
  const possibleGold = possibleRaidGold(characters, tasks, runs);
  const raidsLeft = goldRaidsLeft(characters, tasks, runs);
  const split = raidGoldSplit(thisWeek);
  const gold = goldThisWeek(thisWeek);

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
          icon={<GameIcon name="gold" size={18} fallback={Coins} alt="" />}
          label="Gold this week"
          action={
            <span className="flex items-center gap-2">
              <QuickGold
                accountId={data.accountId || null}
                onLogged={data.loadWeeklyGold}
                onError={(e) => data.setError(describeError(e))}
              />
              <Link href="/gold" className="underline">Gold page</Link>
            </span>
          }
          value={formatGold(gold.total)}
          accent
          sub={
            <>
              <span className="block">{goldThisWeekParts(gold, formatGold) || "nothing yet"}</span>
              {split.characterBound > 0 && (
                <span className="block">
                  + {formatGold(split.characterBound)} bound to {split.spreadOver} character{split.spreadOver === 1 ? "" : "s"}
                </span>
              )}
              <span className="block">of {formatGold(possibleGold)} raid gold possible</span>
            </>
          }
          title="Tradeable + roster-bound gold this week: raids and other gold, after the bonus boxes those paid for. Character-bound gold, which only its own character can spend, is listed beneath."
        />
      ),
    },
  ].filter((stat) => view.isShown(stat.key));

  if (stats.length === 0) return null;
  return (
    <div className={`grid gap-3 ${STAT_COLUMNS[stats.length]}`}>
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
  action,
}: {
  icon: ReactNode;
  label: string;
  /** Small controls at the right of the label, e.g. the quick log. */
  action?: ReactNode;
  value: string;
  sub?: ReactNode;
  accent?: boolean;
  title?: string;
}) {
  return (
    <div className="h-full rounded-lg border border-border bg-surface px-4 py-3" title={title}>
      {/* A fixed height, so a box with controls lines up with one without. */}
      <div className="flex h-6 items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>{value}</div>
      {/* Three lines are always reserved, so a line appearing after a tick doesn't grow the row and move the cards. */}
      <div className="line-clamp-3 min-h-12 text-xs leading-4 text-muted">{sub}</div>
    </div>
  );
}
