import { BookOpen } from "lucide-react";

import { guideById } from "@/lib/guides";

/** A small "Guide" link to a built-in Guides entry, for pages a guide explains. */
export default function GuideLink({ id, label = "Guide" }: { id: string; label?: string }) {
  const guide = guideById(id);
  if (!guide) return null;
  return (
    <a
      href={guide.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${guide.title} (opens in your browser)`}
      className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
    >
      <BookOpen size={12} /> {label}
    </a>
  );
}
