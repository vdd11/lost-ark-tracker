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
// On a phone they stay side by side too (short labels, no detail line), so the grid starts higher.
const STAT_COLUMNS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

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
          shortLabel="Raids left"
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
          shortLabel="Gold"
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
            shortLabel="Dailies"
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
    <div className={`grid gap-2 sm:gap-3 ${STAT_COLUMNS[stats.length]}`}>
      {stats.map((stat) => (
        <div key={stat.key}>{stat.node}</div>
      ))}
    </div>
  );
}

function Stat({
  icon,
  label,
  shortLabel,
  value,
  sub,
  accent,
  title,
  action,
}: {
  icon: ReactNode;
  label: string;
  /** What a phone shows instead of the label. */
  shortLabel: string;
  /** Small controls at the right of the label, e.g. the quick log. */
  action?: ReactNode;
  value: string;
  sub?: ReactNode;
  accent?: boolean;
  title?: string;
}) {
  return (
    <div className="h-full min-w-0 rounded-lg border border-border bg-surface px-2.5 py-2 sm:px-4 sm:py-3" title={title}>
      {/* A fixed height, so a box with controls lines up with one without. */}
      <div className="flex h-6 min-w-0 items-center gap-1.5 text-xs text-muted">
        <span className="hidden shrink-0 sm:inline-flex">{icon}</span>
        <span className="truncate">
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      <div className={`truncate text-lg font-semibold tabular-nums sm:text-xl ${accent ? "text-accent" : ""}`}>{value}</div>
      {/* Two lines are always reserved, so a line appearing after a tick doesn't grow the row and move the cards.
          A phone leaves the detail to the box's tooltip and the cards below. */}
      <div className="hidden min-h-8 text-xs leading-4 text-muted sm:line-clamp-2">{sub}</div>
    </div>
  );
}
