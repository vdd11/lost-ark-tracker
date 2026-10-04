"use client";

import { Pencil, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import AccountTabs from "@/components/AccountTabs";
import ErrorBanner from "@/components/ErrorBanner";
import AnytimeCard from "@/components/tracker/AnytimeCard";
import { TrackerBanners, WelcomeStyle } from "@/components/tracker/Banners";
import CustomizePanel from "@/components/tracker/CustomizePanel";
import StatRow from "@/components/tracker/StatRow";
import TodayCard from "@/components/tracker/TodayCard";
import ToolbarButton from "@/components/tracker/ToolbarButton";
import { useTrackerData } from "@/components/tracker/useTrackerData";
import { useTrackerView } from "@/components/tracker/useTrackerView";
import WeekCard from "@/components/tracker/WeekCard";
import WidgetGrid from "@/components/tracker/WidgetGrid";
import { isActiveRaid } from "@/lib/raids";
import { buildSection } from "@/lib/trackerSections";
import { SECTION_KEYS } from "@/lib/trackerView";

export default function TrackerPage() {
  const data = useTrackerData();
  const view = useTrackerView(data.tasks);
  const [editMode, setEditMode] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  const sectionInput = { tasks: data.tasks, roster: data.roster, completed: data.completed, hidden: view.hidden, editMode };
  const week = buildSection("week", sectionInput);
  const today = buildSection("today", sectionInput);
  const anytime = buildSection("anytime", sectionInput);
  const showToday = view.isShown(SECTION_KEYS.today) && (today.columns.length > 0 || editMode);
  const showAnytime = view.isShown(SECTION_KEYS.anytime) && (anytime.columns.length > 0 || editMode);
  const cardProps = { data, view, editMode };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Roster</h1>
          <AccountTabs accounts={data.accounts} value={data.accountId} onChange={data.setAccountId} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ToolbarButton active={customizing} onClick={() => setCustomizing((v) => !v)} icon={<Settings2 size={16} />}>
            Customize
          </ToolbarButton>
          <ToolbarButton active={editMode} onClick={() => setEditMode((v) => !v)} icon={<Pencil size={16} />}>
            {editMode ? "Done editing" : "Edit who does what"}
          </ToolbarButton>
        </div>
      </div>

      {data.allCharacters.length > 0 && !view.styleChosen && <WelcomeStyle view={view} />}

      <StatRow data={data} view={view} />

      <ErrorBanner error={data.error} onDismiss={() => data.setError(null)} />

      <TrackerBanners data={data} view={view} />

      {customizing && (
        <CustomizePanel
          tasks={data.tasks.filter((t) => t.category !== "raid" || isActiveRaid(t))}
          hidden={view.hidden}
          onChange={view.setVisible}
          onStyle={view.applyStyle}
          onClose={() => setCustomizing(false)}
        />
      )}

      {editMode && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Choose each character&apos;s usual raids, difficulties and tasks. These count toward progress and possible
          gold. Raids a character can enter but doesn&apos;t usually run still show faded, so an extra clear can be
          ticked any week.
        </p>
      )}

      {data.characters.length === 0 && !data.error ? (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          {data.allCharacters.length > 0 ? "No characters on this account yet." : "No characters yet."}{" "}
          <Link href="/settings" className="underline">Add your roster in Settings</Link>.
        </p>
      ) : (
        <>
          <WeekCard section={week} {...cardProps} />

          {(showToday || showAnytime) && (
            <div className={`grid gap-4 ${showToday && showAnytime ? "lg:grid-cols-2" : ""}`}>
              {showToday && <TodayCard section={today} {...cardProps} />}
              {showAnytime && <AnytimeCard section={anytime} {...cardProps} />}
            </div>
          )}

          <WidgetGrid data={data} view={view} />
        </>
      )}
    </div>
  );
}
