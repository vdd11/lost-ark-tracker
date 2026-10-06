"use client";

import { Move, Pencil } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";

import AccountTabs from "@/components/AccountTabs";
import { useShortcutHelp } from "@/components/KeyboardShortcuts";
import { Skeleton } from "@/components/Skeleton";
import { ArrangeableList, PAGE_BLOCKS, PAGE_ORDER_PREFERENCE, useSavedOrder, WIDGET_ORDER_PREFERENCE } from "@/components/tracker/arrange";
import GoldEarnerCount from "@/components/tracker/GoldEarnerCount";
import ErrorBanner from "@/components/ErrorBanner";
import AnytimeCard from "@/components/tracker/AnytimeCard";
import { TrackerBanners, WelcomeStyle } from "@/components/tracker/Banners";
import CustomizePanel from "@/components/tracker/CustomizePanel";
import LoaImportDialog from "@/components/tracker/LoaImportDialog";
import StatRow from "@/components/tracker/StatRow";
import TodayCard from "@/components/tracker/TodayCard";
import ToolbarButton from "@/components/tracker/ToolbarButton";
import { useTrackerData } from "@/components/tracker/useTrackerData";
import { useTrackerView } from "@/components/tracker/useTrackerView";
import WeekCard from "@/components/tracker/WeekCard";
import WhatsLeft from "@/components/tracker/WhatsLeft";
import WidgetGrid from "@/components/tracker/WidgetGrid";
import { isActiveRaid } from "@/lib/raids";
import { LOA_KEYS } from "@/lib/loaLogs";
import { mergeOrder } from "@/lib/order";
import { buildSection } from "@/lib/trackerSections";
import { SECTION_KEYS } from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";
import FirstRun from "@/components/tracker/FirstRun";
import { FIRST_RUN_PREFERENCE, FIRST_RUN_STATES, FirstRunState, showFirstRun } from "@/lib/firstRun";
import GameIcon from "@/components/GameIcon";

const MODES = ["grid", "left"] as const;
const BLOCK_LABELS: Record<string, string> = {
  stats: "Gold boxes",
  recap: "New-week recap",
  week: "This week",
  daily: "Today and Ebony Cube",
  widgets: "Widgets",
};

export default function TrackerPage() {
  const data = useTrackerData();
  const view = useTrackerView(data.tasks);
  const [editMode, setEditMode] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const openShortcuts = useShortcutHelp();
  // Rearranging the page's blocks is its own mode, with its own Done.
  const [arranging, setArranging] = useState(false);
  const [, setWidgetOrderRaw] = usePreference<string>(WIDGET_ORDER_PREFERENCE, "");
  const [firstRun, setFirstRun] = usePreference<FirstRunState>(FIRST_RUN_PREFERENCE, "", FIRST_RUN_STATES);
  const firstRunShown = showFirstRun(data.loaded, data.allCharacters.length, firstRun);
  // The full grid, or only what's left (remembered in this browser).
  const [mode, setMode] = usePreference<(typeof MODES)[number]>("tracker-mode", "grid", MODES);
  const showLeft = mode === "left" && !editMode;
  const [loaEnabled] = usePreference<boolean>(LOA_KEYS.enabled, false);
  const [importing, setImporting] = useState(false);

  const [blockOrder, setBlockOrder] = useSavedOrder(PAGE_ORDER_PREFERENCE, [...PAGE_BLOCKS]);
  const sectionInput = { tasks: data.tasks, roster: data.roster, completed: data.completed, hidden: view.hidden, editMode };
  const week = buildSection("week", sectionInput);
  const today = buildSection("today", sectionInput);
  const anytime = buildSection("anytime", sectionInput);
  const showToday = view.isShown(SECTION_KEYS.today) && (today.columns.length > 0 || editMode);
  const showAnytime = view.isShown(SECTION_KEYS.anytime) && (anytime.columns.length > 0 || editMode);
  const cardProps = { data, view, editMode };

  // The page's blocks, in the order the user arranged them (Customize).
  const blocks: Record<string, ReactNode> = {
    stats: <StatRow data={data} view={view} />,
    recap: <TrackerBanners data={data} view={view} />,
    week: showLeft ? (
      <WhatsLeft data={data} columns={[...week.columns, ...(showToday ? today.columns : [])]} />
    ) : (
      <WeekCard section={week} {...cardProps} />
    ),
    daily:
      !showLeft && (showToday || showAnytime) ? (
        <div className={`grid gap-4 ${showToday && showAnytime ? "lg:grid-cols-2" : ""}`}>
          {showToday && <TodayCard section={today} {...cardProps} />}
          {showAnytime && <AnytimeCard section={anytime} {...cardProps} />}
        </div>
      ) : null,
    widgets: <WidgetGrid data={data} view={view} arranging={arranging} />,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GameIcon name="tracker" size={32} framed alt="" /> Roster
        </h1>
          <AccountTabs accounts={data.accounts} value={data.accountId} onChange={data.setAccountId} />
          <GoldEarnerCount data={data} />
        </div>
        {/* Nothing to show, customize or edit until there's a roster. */}
        <div className={`flex flex-wrap items-center gap-2 ${data.loaded && data.allCharacters.length === 0 ? "hidden" : ""}`}>
          <button
            onClick={openShortcuts}
            className="hidden text-xs text-muted underline-offset-2 hover:text-foreground hover:underline md:inline"
            title="The tracker works from the keyboard: Tab into a card, arrows to move, Space to tick"
          >
            Keyboard: press ?
          </button>
          {loaEnabled && (
            <ToolbarButton active={importing} onClick={() => setImporting(true)} icon={<GameIcon name="loa-logs" size={16} inline alt="" />}>
              Import clears
            </ToolbarButton>
          )}
          <ToolbarButton
            active={mode === "left"}
            onClick={() => setMode(mode === "left" ? "grid" : "left")}
            icon={<GameIcon name="whats-left" size={16} inline alt="" />}
          >
            What&apos;s left
          </ToolbarButton>
          <ToolbarButton active={customizing} onClick={() => setCustomizing(true)} icon={<GameIcon name="settings" size={16} inline alt="" />}>
            Customize
          </ToolbarButton>
          <ToolbarButton active={editMode} onClick={() => setEditMode((v) => !v)} icon={<Pencil size={16} />}>
            {editMode ? "Done editing" : "Edit who does what"}
          </ToolbarButton>
        </div>
      </div>

      {data.allCharacters.length > 0 && !view.styleChosen && !firstRunShown && <WelcomeStyle view={view} />}

      {firstRunShown && (
        <FirstRun
          data={data}
          view={view}
          onStart={() => firstRun !== "active" && setFirstRun("active")}
          onFinish={() => setFirstRun("done")}
        />
      )}

      {importing && <LoaImportDialog data={data} onClose={() => setImporting(false)} />}

      <ErrorBanner error={data.error} onDismiss={() => data.setError(null)} />

      {customizing && (
        <CustomizePanel
          tasks={data.tasks.filter((t) => t.category !== "raid" || isActiveRaid(t))}
          hidden={view.hidden}
          onSave={view.saveHidden}
          onClose={() => setCustomizing(false)}
          onArrange={() => {
            setCustomizing(false);
            setArranging(true);
          }}
        />
      )}

      {arranging && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-accent/50 bg-surface px-4 py-2 text-sm shadow-md">
          <Move size={16} className="text-accent" />
          <span>Drag the blocks and widgets by their names, or use their arrows. Saved as you go.</span>
          <span className="ml-auto flex gap-2">
            <button
              onClick={() => {
                setBlockOrder([...PAGE_BLOCKS]);
                setWidgetOrderRaw("");
              }}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2"
              title="Put the tracker's blocks and widgets back in their usual order"
            >
              Reset order
            </button>
            <button onClick={() => setArranging(false)} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
              Done
            </button>
          </span>
        </div>
      )}

      {editMode && (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Choose each character&apos;s usual raids, difficulties and tasks. These count toward progress and possible
          gold. Raids a character can enter but doesn&apos;t usually run still show faded, so an extra clear can be
          ticked any week.
        </p>
      )}

      {!data.loaded ? (
        <div className="space-y-4" role="status" aria-label="Loading the tracker">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      ) : data.characters.length === 0 && !data.error ? (
        firstRunShown ? null : (
          <p className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
            {data.allCharacters.length > 0 ? "No characters on this account yet." : "No characters yet."}{" "}
            <Link href="/settings" className="underline">Add your roster in Settings</Link>.
          </p>
        )
      ) : (
        <ArrangeableList
          className="space-y-4"
          arranging={arranging}
          onReorder={(keys) => setBlockOrder(mergeOrder(keys, blockOrder))}
          items={blockOrder
            .map((key) => ({ key, id: PAGE_BLOCKS.indexOf(key as (typeof PAGE_BLOCKS)[number]), label: BLOCK_LABELS[key], node: blocks[key] }))
            .filter((block) => block.node)}
        />
      )}
    </div>
  );
}
