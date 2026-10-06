import { X } from "lucide-react";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

import RecapCard from "@/components/tracker/RecapCard";
import StyleChooser from "@/components/tracker/StyleChooser";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { api, CatalogReference } from "@/lib/api";
import { shouldRemindCheckIn, shouldShowRecap } from "@/lib/banners";
import { CATALOG_SEEN_PREFERENCE, CatalogSnapshot, catalogChanges, parseSnapshot, snapshotOf } from "@/lib/catalogDiff";
import { isActiveRaid, raidGold } from "@/lib/raids";
import { missedGoldRaids } from "@/lib/recap";
import { isTiered } from "@/lib/trackerSections";
import { SECTION_KEYS, STAT_KEYS } from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";

export function Notice({
  children,
  onDismiss,
  dismissLabel = "Dismiss until next week",
}: {
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
      <div>{children}</div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label={dismissLabel} title={dismissLabel} className="shrink-0 self-start rounded p-1 text-muted hover:bg-surface-2">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * After an update that changed raid values, a one-time note of what changed,
 * against what this browser last saw. The first visit just remembers them.
 */
export function RaidDataNotice() {
  const [seenRaw, setSeenRaw] = usePreference<string>(CATALOG_SEEN_PREFERENCE, "");
  const [current, setCurrent] = useState<CatalogSnapshot | null>(null);

  useEffect(() => {
    api<CatalogReference>("/raid-catalog")
      .then((reference) => setCurrent(snapshotOf(reference)))
      .catch(() => {});
  }, []);

  const seen = parseSnapshot(seenRaw);
  useEffect(() => {
    if (current && !parseSnapshot(seenRaw)) setSeenRaw(JSON.stringify(current));
  }, [current, seenRaw, setSeenRaw]);

  const changes = current && seen ? catalogChanges(seen, current) : [];
  if (!current || changes.length === 0) return null;
  return (
    <Notice onDismiss={() => setSeenRaw(JSON.stringify(current))} dismissLabel="Got it">
      <span className="font-medium">Raid data changed in this update:</span>
      <ul className="my-1 list-disc pl-5">
        {changes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Link href="/settings/#raids" className="underline">See the raid reference</Link>
    </Notice>
  );
}

/** The one-time "how much do you want to track?" question. */
export function WelcomeStyle({ view }: { view: TrackerView }) {
  return (
    <section className="rounded-lg border border-accent/40 bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">How much do you want to track?</h2>
          <p className="text-xs text-muted">Pick a starting point. You can fine-tune anything later under Customize.</p>
        </div>
        <button onClick={() => view.setStyleChosen(true)} className="shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2">
          Keep as is
        </button>
      </div>
      <StyleChooser current={null} onChoose={view.applyStyle} />
    </section>
  );
}

/** Last week's recap, the weekly check-in reminder, and the unknown-gold notice. */
export function TrackerBanners({ data, view }: { data: TrackerData; view: TrackerView }) {
  const [checkInDismissed, setCheckInDismissed] = usePreference<string>("check-in-dismissed-week", "");
  const [recapDismissed, setRecapDismissed] = usePreference<string>("recap-dismissed-week", "");
  const { tracker, recap, goldWeeks, gemWeeks, characters, tasks, lastCheckIn } = data;

  const lastGoldWeek = goldWeeks.at(-2);
  const lastGemWeek = gemWeeks.at(-2);
  const showRecap =
    tracker &&
    recap &&
    shouldShowRecap({
      enabled: view.isShown(SECTION_KEYS.recap),
      weeklyPeriod: tracker.weekly_period,
      dismissedWeek: recapDismissed,
      now: data.now,
      lastWeekGold: lastGoldWeek?.total ?? 0,
      lastWeekGems: lastGemWeek?.total ?? 0,
      paidRaidCharacters: Object.keys(recap.paid_raids).length,
    });
  // Check-ins are about gold on hand, so they follow the "Gold this week" box.
  const needsCheckIn =
    tracker &&
    shouldRemindCheckIn({
      enabled: view.isShown(STAT_KEYS.raidGold),
      weeklyPeriod: tracker.weekly_period,
      dismissedWeek: checkInDismissed,
      lastCheckIn,
    });
  const hasUnknownGold = characters.some((c) =>
    tasks.some((t) => isActiveRaid(t) && isTiered(t) && c.task_ids.includes(t.id) && raidGold(c, t) === null),
  );

  return (
    <>
      <RaidDataNotice />

      {showRecap && (
        <RecapCard
          week={recap!.week}
          gold={lastGoldWeek}
          previousGold={goldWeeks.at(-3)}
          gems={lastGemWeek}
          missed={missedGoldRaids(characters, tasks, recap!.paid_raids)}
          onDismiss={() => setRecapDismissed(tracker!.weekly_period)}
        />
      )}

      {needsCheckIn && (
        <Notice onDismiss={() => setCheckInDismissed(tracker!.weekly_period)}>
          {lastCheckIn === null
            ? "Want to see gold you spend outside the tracker? Enter how much you have once a week."
            : "New week: check in how much gold you have to see what you spent on untracked things."}{" "}
          <Link href="/gold/#check-in" className="font-medium underline">Check in</Link>
        </Notice>
      )}

      {hasUnknownGold && (
        <Notice>
          Some raids your characters run don&apos;t have a gold value yet (shown as ?). Built-in raids get theirs
          with an app update; enter an event raid&apos;s in{" "}
          <Link href="/settings/#raids" className="font-medium underline">Settings</Link>.
        </Notice>
      )}
    </>
  );
}
