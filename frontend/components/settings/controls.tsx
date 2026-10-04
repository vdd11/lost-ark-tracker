import { GripVertical, Trash2 } from "lucide-react";

import { useDragReorder } from "@/components/useDragReorder";
import { Account } from "@/lib/api";

export type DragHandleProps = ReturnType<ReturnType<typeof useDragReorder>["handleProps"]>;

/** The grip you drag a row by; arrow keys move it too. */
export function DragHandle({ handle }: { handle: DragHandleProps }) {
  return (
    <button
      type="button"
      {...handle}
      className="flex h-7 w-6 cursor-grab touch-none items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical size={16} />
    </button>
  );
}

export const draggingRow = "relative z-10 bg-accent/10 shadow-md ring-1 ring-accent/50";

/** Pick an account; only shown once there's more than one. */
export function AccountSelect({
  accounts,
  value,
  onChange,
  label,
}: {
  accounts: Account[];
  value: number;
  onChange: (accountId: number) => void;
  label: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>{account.name}</option>
      ))}
    </select>
  );
}

export function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button onClick={onDelete} aria-label="Delete" title="Delete" className="rounded-md p-1.5 text-danger hover:bg-danger/10">
      <Trash2 size={14} />
    </button>
  );
}
