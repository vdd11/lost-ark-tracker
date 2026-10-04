"use client";

import { AlarmClock, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, Character, parseUtc, Task, TrackerState } from "@/lib/api";
import {
  dailyReminder,
  DEFAULT_LEAD,
  fullRestItems,
  LEAD_HOURS,
  Reminder,
  REMINDER_KEYS,
  weeklyItems,
  weeklyReminder,
} from "@/lib/reminders";
import { cellKey } from "@/lib/trackerSections";
import { usePreference } from "@/lib/usePreference";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/** Whether this browser can show system notifications, and if it may. */
export function notificationStatus(): "granted" | "denied" | "default" | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

/** A system notification when allowed; otherwise false, so the caller shows a banner. */
export function notify(reminder: Pick<Reminder, "title" | "body" | "resetKey">) {
  if (notificationStatus() !== "granted") return false;
  try {
    new Notification(reminder.title, { body: reminder.body, tag: reminder.resetKey });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks the opt-in reset reminders while any page of the tracker is open:
 * every few minutes it reads the tracker (all local) and, within the lead
 * time, sends a notification, or shows a banner here if notifications are off.
 */
export default function ResetReminders() {
  const [weeklyOn] = usePreference<boolean>(REMINDER_KEYS.weekly, false);
  const [dailyOn] = usePreference<boolean>(REMINDER_KEYS.daily, false);
  const [weeklyLead] = usePreference<number>(REMINDER_KEYS.weeklyLead, DEFAULT_LEAD.weekly, LEAD_HOURS.weekly);
  const [dailyLead] = usePreference<number>(REMINDER_KEYS.dailyLead, DEFAULT_LEAD.daily, LEAD_HOURS.daily);
  const [lastWeekly, setLastWeekly] = usePreference<string>(REMINDER_KEYS.lastWeekly, "");
  const [lastDaily, setLastDaily] = usePreference<string>(REMINDER_KEYS.lastDaily, "");
  const [banners, setBanners] = useState<Reminder[]>([]);

  useEffect(() => {
    if (!weeklyOn && !dailyOn) return;

    async function check() {
      try {
        const [tracker, characters, tasks] = await Promise.all([
          api<TrackerState>("/tracker"),
          api<Character[]>("/characters"),
          api<Task[]>("/tasks"),
        ]);
        const now = new Date();
        const deliver = (reminder: Reminder) => {
          if (!notify(reminder)) setBanners((current) => [...current.filter((b) => b.title !== reminder.title), reminder]);
        };
        if (weeklyOn) {
          const reminder = weeklyReminder({
            now,
            nextReset: parseUtc(tracker.next_weekly_reset),
            leadHours: weeklyLead,
            lastNotifiedFor: lastWeekly,
            items: weeklyItems(characters, tasks, tracker.runs),
          });
          if (reminder) {
            setLastWeekly(reminder.resetKey);
            deliver(reminder);
          }
        }
        if (dailyOn) {
          const completed = new Set(tracker.completed.map(([c, t]) => cellKey(c, t)));
          const reminder = dailyReminder({
            now,
            nextReset: parseUtc(tracker.next_daily_reset),
            leadHours: dailyLead,
            lastNotifiedFor: lastDaily,
            items: fullRestItems(characters, tasks, tracker.rest, completed),
          });
          if (reminder) {
            setLastDaily(reminder.resetKey);
            deliver(reminder);
          }
        }
      } catch {
        // The app's own API is unreachable (it's shutting down); try again next time.
      }
    }

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [weeklyOn, dailyOn, weeklyLead, dailyLead, lastWeekly, lastDaily, setLastWeekly, setLastDaily]);

  if (banners.length === 0) return null;
  return (
    <div className="border-b border-accent/40 bg-accent/10">
      {banners.map((banner) => (
        <div key={banner.title} role="alert" className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2 text-sm">
          <AlarmClock size={16} className="mt-0.5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{banner.title}:</span> {banner.body}{" "}
            <Link href="/" className="underline">Open the tracker</Link>
          </span>
          <button
            onClick={() => setBanners((current) => current.filter((b) => b !== banner))}
            aria-label="Dismiss reminder"
            className="shrink-0 rounded p-0.5 text-muted hover:bg-surface-2"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
