"use client";

import { EyeOff, ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Guide, hostOf } from "@/lib/guides";

/** One link on the Guides page. It opens in the user's browser; nothing is fetched. */
export default function GuideCard({
  guide,
  onHide,
  onEdit,
  onDelete,
}: {
  guide: Guide;
  onHide?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group flex flex-col gap-1 rounded-md border border-border bg-surface p-3 hover:border-accent/60">
      <div className="flex items-start gap-2">
        <a
          href={guide.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 font-medium hover:text-accent"
          title={`Opens ${hostOf(guide.url)} in your browser`}
        >
          {guide.title}
          <ExternalLink size={12} className="ml-1 inline align-baseline text-muted" aria-label="(opens in your browser)" />
        </a>
        <span className="flex shrink-0 gap-0.5">
          {onEdit && (
            <button onClick={onEdit} aria-label={`Edit ${guide.title}`} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground">
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} aria-label={`Delete ${guide.title}`} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-danger">
              <Trash2 size={13} />
            </button>
          )}
          {onHide && (
            <button onClick={onHide} aria-label={`Hide ${guide.title}`} title="Hide" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground">
              <EyeOff size={13} />
            </button>
          )}
        </span>
      </div>
      {guide.description && <p className="text-sm text-muted">{guide.description}</p>}
      <p className="text-xs text-muted/80">{hostOf(guide.url)}</p>
    </div>
  );
}
