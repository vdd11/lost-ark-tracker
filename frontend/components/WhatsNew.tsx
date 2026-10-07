"use client";

import { ExternalLink, X } from "lucide-react";

import GameIcon from "@/components/GameIcon";
import { useDialog } from "@/components/useDialog";
import { releasePage } from "@/lib/updates";
import { highlightParts, WhatsNewEntry } from "@/lib/whatsNew";

/**
 * What changed, from the notes bundled with the app (nothing is fetched).
 * After an update: "Updated to x.y.z" with each new release's highlights.
 * Opened by hand: every release, newest first, with all its notes.
 */
export default function WhatsNewDialog({
  entries,
  updatedTo,
  onClose,
}: {
  entries: WhatsNewEntry[];
  /** Set after an update: the version now running. */
  updatedTo?: string;
  onClose: () => void;
}) {
  const dialog = useDialog(onClose);
  const full = !updatedTo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {updatedTo && <p className="text-xs font-medium uppercase tracking-wide text-accent">Updated to {updatedTo}</p>}
            <h2 id="whats-new-title" className="flex items-center gap-2 text-lg font-semibold">
              <GameIcon name="whats-new" size={24} framed alt="" /> What&apos;s new
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          {(full ? entries : [...entries].reverse()).map((entry) => (
            <section key={entry.version} aria-label={`Version ${entry.version}`}>
              <h3 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-semibold">
                <span>Version {entry.version}</span>
                <span className="text-xs font-normal text-muted">{entry.date}</span>
              </h3>
              <ul className="space-y-2">
                {entry.highlights.map((highlight) => {
                  const { icon, text } = highlightParts(highlight);
                  return (
                    <li key={text} className="flex items-start gap-2.5 text-sm">
                      <GameIcon name={icon} size={22} framed alt="" />
                      <span className="pt-0.5">{text}</span>
                    </li>
                  );
                })}
              </ul>
              {full &&
                entry.sections?.map((section) => (
                  <div key={section.title} className="mt-3">
                    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{section.title}</h4>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              <a
                href={releasePage(entry.version)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted underline hover:text-foreground"
              >
                Full release notes on GitHub <ExternalLink size={12} />
              </a>
            </section>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button data-autofocus onClick={onClose} className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background">
            {updatedTo ? "Got it" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
