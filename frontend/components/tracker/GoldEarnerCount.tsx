import { Coins } from "lucide-react";

import { TrackerData } from "@/components/tracker/useTrackerData";
import { goldEarnerCounts } from "@/lib/goldEarners";

/** "5/6 gold earners" for the account shown, or for each account. */
export default function GoldEarnerCount({ data }: { data: TrackerData }) {
  const accounts = data.accountId ? data.accounts.filter((a) => a.id === data.accountId) : data.accounts;
  const counts = goldEarnerCounts(data.allCharacters, accounts);
  if (!counts.length) return null;
  const many = counts.length > 1;
  return (
    <span
      className="flex items-center gap-1 text-xs text-muted tabular-nums"
      title="Gold earners are paid for 3 raids a week; each account (roster) can have 6. Click GOLD beside a name to change."
    >
      <Coins size={13} />
      {counts.map((c, i) => (
        <span key={c.account.id} className={c.earners > c.max ? "text-danger" : ""}>
          {i > 0 && " · "}
          {many ? `${c.account.name} ` : ""}
          {c.earners}/{c.max}
          {many ? "" : " gold earners"}
        </span>
      ))}
    </span>
  );
}
