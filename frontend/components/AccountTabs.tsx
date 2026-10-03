"use client";

import { Account } from "@/lib/api";
import { usePreference } from "@/lib/usePreference";

/**
 * Which account's roster a page shows, shared by the tracker and the Gold page
 * and remembered in this browser. 0 means all accounts, which is also what a
 * single-account roster or a since-removed account falls back to.
 */
export function useAccountChoice(accounts: Account[]): [number, (accountId: number) => void] {
  const [chosen, setChosen] = usePreference<number>("tracker-account", 0);
  const accountId = accounts.length > 1 && accounts.some((a) => a.id === chosen) ? chosen : 0;
  return [accountId, setChosen];
}

/** Switch between accounts' rosters; renders nothing with a single account. */
export default function AccountTabs({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: number;
  onChange: (accountId: number) => void;
}) {
  if (accounts.length < 2) return null;
  const options = [{ id: 0, name: "All accounts" }, ...accounts];
  return (
    <div role="tablist" aria-label="Account" className="flex flex-wrap gap-0.5 rounded-lg border border-border bg-surface p-0.5 text-sm">
      {options.map((account) => (
        <button
          key={account.id}
          role="tab"
          aria-selected={value === account.id}
          onClick={() => onChange(account.id)}
          className={`rounded-md px-3 py-1 ${
            value === account.id ? "bg-accent/15 font-medium text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          {account.name}
        </button>
      ))}
    </div>
  );
}
