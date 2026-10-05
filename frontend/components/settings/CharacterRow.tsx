"use client";

import { useState } from "react";

import ClassInput from "@/components/ClassInput";
import { AccountSelect, DeleteButton, DragHandle, DragHandleProps, draggingRow } from "@/components/settings/controls";
import { Account, Character } from "@/lib/api";
import { normalizeClass } from "@/lib/classes";
import GameIcon from "@/components/GameIcon";
import { classIconName } from "@/lib/data/icons";

// Rows keep a local draft and save a field when it loses focus.
export default function CharacterRow({
  character,
  accounts,
  rowRef,
  dragging,
  handle,
  onSave,
  onDelete,
}: {
  character: Character;
  accounts: Account[];
  rowRef: (element: HTMLElement | null) => void;
  dragging: boolean;
  handle: DragHandleProps;
  onSave: (changes: Partial<Character>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    name: character.name,
    class_name: character.class_name,
    item_level: String(character.item_level || ""),
  });

  function saveText(field: "name" | "class_name", text = draft[field]) {
    const value = field === "class_name" ? normalizeClass(text) : text.trim();
    if (value && value !== character[field]) onSave({ [field]: value });
  }

  return (
    <tr ref={rowRef} className={`border-b border-border last:border-b-0 ${dragging ? draggingRow : ""}`}>
      <td className="py-1.5 pl-2">
        <DragHandle handle={handle} />
      </td>
      <td className="px-3 py-1.5">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => saveText("name")} />
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <GameIcon name={classIconName(draft.class_name)} size={22} alt="" />
          <ClassInput
          value={draft.class_name}
          onChange={(value) => setDraft((prev) => ({ ...prev, class_name: value }))}
          onPick={(value) => saveText("class_name", value)}
          onBlur={() => saveText("class_name")}
          label={`${character.name} class`}
          />
        </div>
      </td>
      <td className="px-3 py-1.5">
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-28"
          value={draft.item_level}
          onChange={(e) => setDraft({ ...draft, item_level: e.target.value })}
          onBlur={() => {
            const value = Number(draft.item_level) || 0;
            if (value !== character.item_level) onSave({ item_level: value });
          }}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="checkbox"
          checked={character.is_gold_earner}
          onChange={(e) => onSave({ is_gold_earner: e.target.checked })}
          aria-label={`${character.name} is a gold earner`}
        />
      </td>
      {accounts.length > 0 && (
        <td className="px-3 py-1.5">
          <AccountSelect
            accounts={accounts}
            value={character.account_id}
            onChange={(accountId) => onSave({ account_id: accountId })}
            label={`${character.name} account`}
          />
        </td>
      )}
      <td className="px-3 py-1.5 text-right">
        <DeleteButton onDelete={onDelete} />
      </td>
    </tr>
  );
}
