"use client";

import { FormEvent, useState } from "react";

import ClassInput from "@/components/ClassInput";
import RaidPicker, { RaidSelection, suggestedRaids } from "@/components/RaidPicker";
import { AccountSelect } from "@/components/settings/controls";
import { Account, Task } from "@/lib/api";
import { normalizeClass } from "@/lib/classes";

export default function AddCharacterForm({
  accounts,
  raids,
  onAdd,
}: {
  accounts: Account[];
  raids: Task[];
  onAdd: (data: object) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [className, setClassName] = useState("");
  const [itemLevel, setItemLevel] = useState("");
  const [isGoldEarner, setIsGoldEarner] = useState(true);
  const [selectedRaids, setSelectedRaids] = useState<RaidSelection>({});
  // Until the raid list is changed by hand, it follows the item level.
  const [autoPick, setAutoPick] = useState(true);

  function changeItemLevel(value: string) {
    setItemLevel(value);
    if (autoPick) setSelectedRaids(suggestedRaids(raids, Number(value) || 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onAdd({
      name: name.trim(),
      class_name: normalizeClass(className),
      item_level: Number(itemLevel) || 0,
      is_gold_earner: isGoldEarner,
      account_id: accounts.length ? (accountId ?? accounts[0].id) : undefined,
      raids: Object.entries(selectedRaids).map(([taskId, difficultyId]) => ({
        task_id: Number(taskId),
        difficulty_id: difficultyId || null,
      })),
    });
    setName("");
    setClassName("");
    setItemLevel("");
    setSelectedRaids({});
    setAutoPick(true);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 text-sm">
      <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <ClassInput required placeholder="Class" label="Class" value={className} onChange={setClassName} />
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Item level"
        value={itemLevel}
        onChange={(e) => changeItemLevel(e.target.value)}
        className="w-28"
      />
      {accounts.length > 0 && (
        <AccountSelect accounts={accounts} value={accountId ?? accounts[0].id} onChange={setAccountId} label="Account" />
      )}
      <label className="flex items-center gap-1.5 px-1 py-1.5">
        <input type="checkbox" checked={isGoldEarner} onChange={(e) => setIsGoldEarner(e.target.checked)} />
        Gold earner
      </label>
      <RaidPicker
        raids={raids}
        itemLevel={Number(itemLevel) || 0}
        isGoldEarner={isGoldEarner}
        value={selectedRaids}
        onChange={(value) => {
          setSelectedRaids(value);
          setAutoPick(false);
        }}
      />
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
        Add character
      </button>
    </form>
  );
}
