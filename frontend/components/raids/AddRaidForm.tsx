"use client";

import { useState } from "react";

export default function AddRaidForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onAdd(name.trim());
        setName("");
      }}
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <input required placeholder="Raid not listed? Add it, e.g. Thaemine" value={name} onChange={(e) => setName(e.target.value)} className="w-72" />
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
        Add custom raid
      </button>
    </form>
  );
}
