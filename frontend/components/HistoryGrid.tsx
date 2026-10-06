"use client";

import { useEffect, useState } from "react";

import { api, byPosition, Character, formatGold, Task } from "@/lib/api";
import { CellTone, firstTrackedWeek, missedRaids, weekTone, WeeklyHistory } from "@/lib/history";
import { formatShortGold, goldRaidWeek } from "@/lib/raids";
import GameIcon from "@/components/GameIcon";
import { classIconName } from "@/lib/data/icons";

const TONES: Record<CellTone, string> = {
  full: "bg-done/20 text-foreground",
  partial: "bg-accent/20 text-foreground",
  missed: "bg-danger/15 text-foreground",
  none: "bg-surface-2/60 text-muted",
  untracked: "text-muted/50",
};

const shortWeek = (week: string) => new Date(`${week}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Characters by the last 8 weeks: paid gold raids out of their slots, and
 * gold earned. Makes it easy to spot who's slipping or which alt to drop.
 */
export default function HistoryGrid({ characters, tasks }: { characters: Character[]; tasks: Task[] }) {
  const [history, setHistory] = useState<WeeklyHistory | null>(null);

  useEffect(() => {
    api<WeeklyHistory>("/history/weekly?weeks=8")
      .then(setHistory)
      .catch(() => setHistory(null));
  }, []);

  if (!history || characters.length === 0) return null;
  const roster = [...characters].sort(byPosition);

  return (
    <section className="overflow-x-auto rounded-md border border-border bg-surface p-4">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <GameIcon name="history" size={20} alt="" /> Weekly history
      </h2>
      <p className="mb-3 text-xs text-muted">
        Paid gold raids out of each gold earner&apos;s slots (from the raids they can enter now) and gold earned, per
        week. Green is every slot used, amber some, red none; blank weeks are from before anything was tracked for
        them. This week is still in progress.
      </p>
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr className="text-muted">
            <th className="px-1 text-left font-medium">Character</th>
            {history.weeks.map((week, i) => (
              <th key={week} className="px-1 text-center font-medium">
                {i === history.weeks.length - 1 ? "This week" : shortWeek(week)}
              </th>
            ))}
            <th className="px-1 text-right font-medium" title="Gold raids not run in finished weeks since tracking started">Missed</th>
            <th className="px-1 text-right font-medium">Avg / week</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((character) => {
            const cells = history.characters[String(character.id)];
            const weeks = history.weeks.map((_, i) => cells?.[i]);
            const slots = goldRaidWeek(character, tasks, []).slots;
            const first = firstTrackedWeek(weeks);
            const finished = first === -1 ? [] : weeks.slice(first, -1);
            const average = finished.length ? finished.reduce((sum, w) => sum + (w?.gold ?? 0), 0) / finished.length : 0;
            const missed = missedRaids(weeks, slots, character.is_gold_earner);
            return (
              <tr key={character.id}>
                <td className="whitespace-nowrap px-1 py-0.5 text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    <GameIcon name={classIconName(character.class_name)} size={28} rem alt="" />
                    {character.name}
                  </span>
                </td>
                {weeks.map((week, i) => {
                  const current = i === weeks.length - 1;
                  // Weeks before anything was recorded for them aren't failures.
                  const untracked = first === -1 ? i < weeks.length - 1 : i < first;
                  const graded = untracked ? "untracked" : weekTone(week, slots, character.is_gold_earner);
                  // This week isn't over: nothing done yet isn't a miss.
                  const tone = current && graded === "missed" ? "none" : graded;
                  const raidsText = character.is_gold_earner && slots > 0 ? `${Math.min(week?.paid_raids ?? 0, slots)}/${slots}` : `${week?.raids ?? 0} raids`;
                  return (
                    <td
                      key={history.weeks[i]}
                      title={`${character.name}, week of ${shortWeek(history.weeks[i])}: ${week?.raids ?? 0} raid clears (${week?.paid_raids ?? 0} paid gold), ${formatGold(week?.gold ?? 0)} gold`}
                      className={`min-w-16 rounded px-1 py-1 text-center tabular-nums ${TONES[tone]} ${current ? "opacity-70" : ""}`}
                    >
                      <div className="font-medium">{untracked ? "–" : raidsText}</div>
                      <div className="text-xs text-muted">{week?.gold ? formatShortGold(week.gold) : "–"}</div>
                    </td>
                  );
                })}
                <td className={`px-1 text-right tabular-nums ${missed > 0 ? "text-danger" : "text-muted"}`}>{missed || "–"}</td>
                <td className="px-1 text-right tabular-nums">{formatShortGold(Math.round(average))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
