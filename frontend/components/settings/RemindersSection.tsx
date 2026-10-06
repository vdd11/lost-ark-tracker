"use client";

import { useState, useSyncExternalStore } from "react";

import { notificationStatus, notify } from "@/components/ResetReminders";
import { DEFAULT_LEAD, LEAD_HOURS, REMINDER_KEYS } from "@/lib/reminders";
import { usePreference } from "@/lib/usePreference";
import GameIcon from "@/components/GameIcon";

const STATUS_TEXT = {
  granted: "Reminders show as system notifications.",
  denied: "Notifications are blocked for this page, so reminders show as a banner at the top of the app instead.",
  default: "Turn a reminder on to allow notifications; until then they show as a banner in the app.",
  unsupported: "This browser can't show notifications, so reminders show as a banner in the app.",
};

/** Opt-in reminders before the weekly and daily resets. Off until turned on; saved in this browser. */
export default function RemindersSection() {
  const [weeklyOn, setWeeklyOn] = usePreference<boolean>(REMINDER_KEYS.weekly, false);
  const [dailyOn, setDailyOn] = usePreference<boolean>(REMINDER_KEYS.daily, false);
  const [weeklyLead, setWeeklyLead] = usePreference<number>(REMINDER_KEYS.weeklyLead, DEFAULT_LEAD.weekly, LEAD_HOURS.weekly);
  const [dailyLead, setDailyLead] = usePreference<number>(REMINDER_KEYS.dailyLead, DEFAULT_LEAD.daily, LEAD_HOURS.daily);
  // The browser's permission, read after load (the pre-rendered page can't know it);
  // bumping `asked` re-reads it after the permission prompt.
  const [asked, setAsked] = useState(0);
  const status = useSyncExternalStore(
    () => () => {},
    () => (asked >= 0 ? notificationStatus() : "unsupported"),
    () => "unsupported" as const,
  );
  const [tested, setTested] = useState<string | null>(null);

  async function turnOn(set: (on: boolean) => void, on: boolean) {
    set(on);
    if (on && notificationStatus() === "default") {
      await Notification.requestPermission();
      setAsked((n) => n + 1);
    }
  }

  function sendTest() {
    const shown = notify({ title: "Lost Ark Tracker", body: "Reminders are working.", resetKey: "test" });
    setTested(shown ? "Sent a test notification." : "Notifications aren't allowed here, so reminders will show as a banner instead.");
  }

  const leadSelect = (value: number, options: readonly number[], onChange: (hours: number) => void, label: string) => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="py-0.5 text-xs">
      {options.map((hours) => (
        <option key={hours} value={hours}>{hours}h before</option>
      ))}
    </select>
  );

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <GameIcon name="reminders" size={32} alt="" /> Reminders
      </h2>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Get a nudge before a reset. The app checks while any of its pages is open in your browser (it has no
        background service), every few minutes. Saved in this browser.
      </p>
      <div className="max-w-3xl space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
          <input type="checkbox" checked={weeklyOn} onChange={(e) => turnOn(setWeeklyOn, e.target.checked)} className="h-4 w-4" />
          <span className="flex-1 text-sm font-medium">Remind me before the weekly reset if gold raids are left</span>
          {leadSelect(weeklyLead, LEAD_HOURS.weekly, setWeeklyLead, "Weekly reminder lead time")}
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
          <input type="checkbox" checked={dailyOn} onChange={(e) => turnOn(setDailyOn, e.target.checked)} className="h-4 w-4" />
          <span className="flex-1 text-sm font-medium">Remind me if Chaos Dungeon (or other) rest is full and unused today</span>
          {leadSelect(dailyLead, LEAD_HOURS.daily, setDailyLead, "Daily reminder lead time")}
        </label>
      </div>
      <div className="mt-2 flex max-w-3xl flex-wrap items-center gap-3 text-xs text-muted">
        <span>{STATUS_TEXT[status]}</span>
        <button onClick={sendTest} className="rounded-md border border-border px-2 py-0.5 hover:bg-surface-2">
          Send a test
        </button>
        {tested && <span>{tested}</span>}
      </div>
    </section>
  );
}
