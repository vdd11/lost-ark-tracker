"use client";

import { FormEvent, useState } from "react";

import { GuideLink, MY_LINKS } from "@/lib/guides";

export type GuideLinkDraft = { title: string; url: string; description: string | null; category: string };

/** Add or edit one of the user's own links. */
export default function GuideLinkForm({
  link,
  categories,
  onSave,
  onCancel,
}: {
  link?: GuideLink;
  categories: string[];
  onSave: (draft: GuideLinkDraft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(link?.title ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [description, setDescription] = useState(link?.description ?? "");
  const [category, setCategory] = useState(link?.category ?? MY_LINKS);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await onSave({
      title: title.trim(),
      url: url.trim(),
      description: description.trim() || null,
      category: category.trim() || MY_LINKS,
    });
    if (saved && !link) {
      setTitle("");
      setUrl("");
      setDescription("");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 text-sm">
      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Link title" maxLength={100} />
      <input
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        aria-label="Link address"
        maxLength={500}
        className="min-w-56 flex-1"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        aria-label="Link description"
        maxLength={300}
        className="min-w-56 flex-1"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        list="guide-categories"
        aria-label="Link category"
        maxLength={50}
        className="w-40"
      />
      <datalist id="guide-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
        {link ? "Save" : "Add link"}
      </button>
      <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
        {link ? "Cancel" : "Close"}
      </button>
    </form>
  );
}
