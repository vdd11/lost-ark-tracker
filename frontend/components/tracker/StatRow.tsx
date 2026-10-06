import { ReactNode } from "react";

import { describeError } from "@/components/ErrorBanner";
import QuickGold from "@/components/QuickGold";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { formatGold } from "@/lib/api";
import { dailiesToday } from "@/lib/dailies";
import { EMBERS_PREFERENCE, embersThisWeek } from "@/lib/embers";
import { usePreference } from "@/lib/usePreference";
import { goldThisWeek } from "@/lib/goldEarners";
import { goldRaidsLeft, possibleSharedGold } from "@/lib/raids";
import { buildSection, cellKey } from "@/lib/trackerSections";
import { STAT_KEYS } from "@/lib/trackerView";
import GameIcon from "@/components/GameIcon";

// Static class names so Tailwind generates them: the row fits however many boxes are shown.
const STAT_COLUMNS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3"];

/** The boxes along the top of the tracker, each of which can be hidden in Customize. */
export default function StatRow({ data, view }: { data: TrackerData; view: TrackerView }) {
  const { thisWeek, characters, tasks, runs } = data;
  const [emberLogging] = usePreference<boolean>(EMBERS_PREFERENCE, false);
  if (!thisWeek) return null;
  const embers = embersThisWeek(data.tracker?.embers ?? [], characters);
  const possibleGold = possibleSharedGold(characters, tasks, runs);
  const raidsLeft = goldRaidsLeft(characters, tasks, runs);
  const gold = goldThisWeek(thisWeek);
  const today = buildSection("today", { tasks, roster: data.roster, completed: data.completed, hidden: view.hidden, editMode: false });
  const dailies = dailiesToday(today.columns, data.roster, (c, t) => data.completed.has(cellKey(c.id, t.id)));

  const stats = [
    {
      key: STAT_KEYS.raidsLeft,
      node: (
        <Stat
          icon={<GameIcon name="gold-raids" size={24} framed alt="" />}
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
          icon={<GameIcon name="gold" size={24} framed alt="" />}
          label="Gold this week"
          action={
            <QuickGold
              accountId={data.accountId || null}
              onLogged={data.loadWeeklyGold}
              onError={(e) => data.setError(describeError(e))}
            />
          }
          value={formatGold(gold.total)}
          accent
          sub={`raids ${formatGold(gold.raids)} of ${formatGold(possibleGold)} · other ${formatGold(gold.other)}`}
          title="Tradeable + roster-bound gold this week, after the bonus boxes it paid for (boxes use a character's own bound gold first). Raids: out of what the roster's gold raids can still pay, not counting character-bound gold. Other: gold you logged."
        />
      ),
    },
    {
      key: STAT_KEYS.dailies,
      node:
        dailies.total > 0 ? (
          <Stat
            icon={<GameIcon name="today" size={24} framed alt="" />}
            label="Dailies today"
            value={`${dailies.done}/${dailies.total}`}
            accent={dailies.done < dailies.total}
            sub={
              <>
                <span className="block">{dailies.perTask.map((d) => `${d.task.name} ${d.done}/${d.total}`).join(" · ")}</span>
                {emberLogging && (
                  <span className="block">
                    Embers this week: {embers.fate} fate{embers.blessed > 0 ? ` · ${embers.blessed} blessed` : ""}
                  </span>
                )}
              </>
            }
            title="Daily tasks done today by the characters who do them (resets at 10:00 UTC)"
          />
        ) : null,
    },
  ].filter((stat) => stat.node && view.isShown(stat.key));

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
      {/* Two lines are always reserved, so a line appearing after a tick doesn't grow the row and move the cards. */}
      <div className="line-clamp-2 min-h-8 text-xs leading-4 text-muted">{sub}</div>
    </div>
  );
}
