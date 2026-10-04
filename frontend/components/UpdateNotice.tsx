"use client";

import { Download, ExternalLink, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, Character } from "@/lib/api";
import { UPDATE_CHECK_CHOICES, UPDATE_CHECK_PREFERENCE, updateCheckState, UpdateCheckState } from "@/lib/online";
import {
  assetFor,
  justUpdated,
  parseRelease,
  Platform,
  platformLabel,
  Release,
  releaseNoteLines,
  releasePage,
} from "@/lib/updates";
import { usePreference } from "@/lib/usePreference";
import { isNewer } from "@/lib/version";

const RELEASES_API = "https://api.github.com/repos/vdd11/lost-ark-tracker/releases/latest";
const CACHE_KEY = "latest-release-v2";
const LAST_VERSION_PREFERENCE = "last-run-version";

type Running = { version: string; platform?: Platform };

async function latestRelease(): Promise<Release | null> {
  // Once per browser session, to stay well inside GitHub's rate limit.
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) return null;
  const release = parseRelease(await response.json());
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(release));
  } catch {}
  return release;
}

/**
 * Whether the GitHub update check may run (see lib/online.ts), and a way to
 * answer the one-time question. Null until the roster has loaded.
 */
export function useUpdateCheck(): [UpdateCheckState | null, (choice: "on" | "off") => void] {
  const [stored, setStored] = usePreference<string>(UPDATE_CHECK_PREFERENCE, "", UPDATE_CHECK_CHOICES);
  const [hasCharacters, setHasCharacters] = useState<boolean | null>(null);

  useEffect(() => {
    api<Character[]>("/characters")
      .then((characters) => setHasCharacters(characters.length > 0))
      .catch(() => {});
  }, []);

  return [hasCharacters === null ? null : updateCheckState(stored, hasCharacters), setStored];
}

/**
 * A button in the nav when a newer release is on GitHub; it opens what's new
 * and how to update. Only checks when allowed; silent offline. Without the
 * check, the first run after an update still says so (a link, nothing fetched).
 */
export default function UpdateNotice({ enabled }: { enabled: boolean }) {
  const [running, setRunning] = useState<Running | null>(null);
  const [update, setUpdate] = useState<Release | null>(null);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = usePreference<string>(LAST_VERSION_PREFERENCE, "");
  // Decided once per page load, before lastSeen is moved on to this version.
  const [updatedTo, setUpdatedTo] = useState<string | null>(null);

  // The saved value loads after the first render, so read it when the answer comes.
  const lastSeenRef = useRef(lastSeen);
  useEffect(() => {
    lastSeenRef.current = lastSeen;
  }, [lastSeen]);

  useEffect(() => {
    api<Running>("/")
      .then((info) => {
        setRunning(info);
        if (justUpdated(lastSeenRef.current, info.version)) setUpdatedTo(info.version);
        if (lastSeenRef.current !== info.version) setLastSeen(info.version);
      })
      .catch(() => {});
  }, [setLastSeen]);

  useEffect(() => {
    if (!enabled || !running) return;
    latestRelease()
      .then((latest) => {
        if (latest && isNewer(latest.version, running.version)) setUpdate(latest);
      })
      .catch(() => {});
  }, [enabled, running]);

  if (update && enabled) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20"
        >
          Update available: v{update.version}
        </button>
        {open && <UpdateDialog release={update} running={running} onClose={() => setOpen(false)} />}
      </>
    );
  }

  if (updatedTo) {
    return (
      <span className="flex items-center gap-1 rounded-md border border-done/40 bg-done/10 px-2 py-1 text-xs">
        <Sparkles size={12} className="text-done" />
        <a href={releasePage(updatedTo)} target="_blank" rel="noreferrer" className="hover:underline">
          Updated to v{updatedTo}: what&apos;s new
        </a>
        <button onClick={() => setUpdatedTo(null)} aria-label="Dismiss" className="rounded p-0.5 text-muted hover:text-foreground">
          <X size={12} />
        </button>
      </span>
    );
  }

  return null;
}

/** What's new in the release, the download for this computer, and how to swap it in. */
function UpdateDialog({ release, running, onClose }: { release: Release; running: Running | null; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const platform = running?.platform ?? null;
  const download = assetFor(release.assets, platform);
  const notes = releaseNoteLines(release.notes);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="update-title" className="flex items-center gap-2 font-semibold">
            <RefreshCw size={18} className="text-accent" /> Version {release.version} is out
          </h2>
          <button ref={closeButton} onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-sm text-muted">You have {running?.version ?? "an older version"}.</p>

        <h3 className="mb-1 text-sm font-semibold">What&apos;s new</h3>
        {notes.length ? (
          <div className="mb-4 max-h-60 overflow-y-auto rounded-md bg-surface-2/60 p-3 text-sm">
            {notes.map((line, i) =>
              line.kind === "heading" ? (
                <p key={i} className="mt-2 font-medium first:mt-0">
                  {line.text}
                </p>
              ) : line.kind === "item" ? (
                <p key={i} className="pl-3 -indent-3">
                  • {line.text}
                </p>
              ) : (
                <p key={i}>{line.text}</p>
              ),
            )}
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted">This release has no notes here; the release page lists every change.</p>
        )}

        <h3 className="mb-1 text-sm font-semibold">How to update</h3>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">
          <li>Download the new version{platform ? ` for ${platformLabel(platform)}` : ""}.</li>
          <li>
            {platform === "windows"
              ? "Quit the tracker: right-click its icon in the system tray, then Quit."
              : "Quit the tracker: close its terminal window."}
          </li>
          <li>
            Replace your old copy with the download and run it.
            {platform === "macos" && " In Terminal, run the same chmod +x and xattr commands as the first time."}
            {platform === "linux" && " Make it executable first: chmod +x LostArkTracker-linux."}
          </li>
        </ol>
        <p className="mb-4 text-xs text-muted">
          Your characters and history are kept in your data folder, not in the app file, so nothing is lost. The tracker
          also backs up that data each day it starts.
          {platform === "windows" && " Windows may warn that the download is from an unknown publisher: choose More info, then Run anyway."}
        </p>

        <div className="flex flex-wrap gap-2">
          {download && (
            <a
              href={download.url}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
            >
              <Download size={14} /> Download for {platformLabel(platform!)}
            </a>
          )}
          <a
            href={release.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            <ExternalLink size={14} /> Release page
          </a>
        </div>
      </div>
    </div>
  );
}

/** Asked once on a new install, before anything is fetched from GitHub. */
export function UpdateCheckPrompt({ onChoose }: { onChoose: (choice: "on" | "off") => void }) {
  return (
    <div className="border-t border-border bg-accent/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm">
        <RefreshCw size={14} className="text-accent" />
        <span>
          Check github.com for new versions of Lost Ark Tracker?{" "}
          <span className="text-muted">It contacts GitHub once per session; nothing about you is sent. You can change this in Settings.</span>
        </span>
        <span className="ml-auto flex gap-2">
          <button onClick={() => onChoose("on")} className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-background">
            Check for updates
          </button>
          <button onClick={() => onChoose("off")} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-surface-2">
            No thanks
          </button>
        </span>
      </div>
    </div>
  );
}
