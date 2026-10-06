import Link from "next/link";

import { TrackerData } from "@/components/tracker/useTrackerData";
import { goldEarnerCounts } from "@/lib/goldEarners";
import GameIcon from "@/components/GameIcon";

/** "5/6 gold earners" for the account shown, or for each account. */
export default function GoldEarnerCount({ data }: { data: TrackerData }) {
  const accounts = data.accountId ? data.accounts.filter((a) => a.id === data.accountId) : data.accounts;
  const counts = goldEarnerCounts(data.allCharacters, accounts);
  if (!counts.length) return null;
  const many = counts.length > 1;
  const names = counts
    .map((c) => {
      const earners = data.allCharacters.filter((ch) => ch.account_id === c.account.id && ch.is_gold_earner).map((ch) => ch.name);
      return `${many ? `${c.account.name}: ` : ""}${earners.join(", ") || "none"}`;
    })
    .join("\n");
  return (
    <span
      className="flex items-center gap-1 text-xs text-muted tabular-nums"
      title={`Gold earners (paid for 3 raids a week; 6 per account). Click GOLD beside a name to change.\n${names}`}
    >
      <GameIcon name="gold" size={14} alt="" />
      {counts.map((c, i) => (
        <span key={c.account.id} className={c.earners > c.max ? "text-danger" : ""}>
          {i > 0 && " · "}
          {many ? `${c.account.name} ` : ""}
          {c.earners}/{c.max}
          {many ? "" : " gold earners"}
        </span>
      ))}
      <Link href="/settings#gold-setup" className="ml-1 underline hover:text-foreground" title="Suggest the best gold earners and raids">
        Review
      </Link>
    </span>
  );
}
