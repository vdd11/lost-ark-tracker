"use client";

import { Plus, Users, X } from "lucide-react";
import { useState } from "react";

import { Account } from "@/lib/api";

/**
 * The game accounts characters belong to. Each is its own roster: up to 6
 * gold earners and its own once-per-roster event clears. Names save when
 * the field loses focus; only empty accounts can be removed.
 */
export default function AccountsBar({
  accounts,
  onAdd,
  onRename,
  onDelete,
}: {
  accounts: Account[];
  onAdd: (name: string) => void;
  onRename: (account: Account, name: string) => void;
  onDelete: (account: Account) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted">
        <Users size={16} /> Accounts
      </span>
      {accounts.map((account) => (
        <AccountChip
          key={`${account.id}-${account.name}`}
          account={account}
          canDelete={accounts.length > 1 && account.characters === 0}
          onRename={(name) => onRename(account, name)}
          onDelete={() => onDelete(account)}
        />
      ))}
      <button
        onClick={() => onAdd(`Account ${accounts.length + 1}`)}
        className="flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-muted hover:border-accent/60 hover:text-foreground"
      >
        <Plus size={14} /> Add account
      </button>
      {accounts.length === 1 && (
        <span className="text-xs text-muted">Play on more than one account? Add one to track each roster on its own.</span>
      )}
    </div>
  );
}

function AccountChip({
  account,
  canDelete,
  onRename,
  onDelete,
}: {
  account: Account;
  canDelete: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(account.name);
  return (
    <span className="flex items-center rounded-md border border-border bg-surface">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== account.name && onRename(name.trim())}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label={`${account.name} name`}
        size={Math.max(6, name.length)}
        className="border-0 bg-transparent py-1 pl-2.5 pr-1"
      />
      <span className="pr-2 text-xs text-muted" title="Characters on this account">
        {account.characters}
      </span>
      {canDelete && (
        <button onClick={onDelete} aria-label={`Remove ${account.name}`} className="mr-1 rounded p-0.5 text-muted hover:bg-danger/10 hover:text-danger">
          <X size={14} />
        </button>
      )}
    </span>
  );
}
