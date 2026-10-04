"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { api, Character } from "@/lib/api";
import { UPDATE_CHECK_CHOICES, UPDATE_CHECK_PREFERENCE, updateCheckState, UpdateCheckState } from "@/lib/online";
import { usePreference } from "@/lib/usePreference";
import { isNewer } from "@/lib/version";

const RELEASES_API = "https://api.github.com/repos/vdd11/lost-ark-tracker/releases/latest";
const CACHE_KEY = "latest-release";

type Release = { version: string; url: string };

async function latestRelease(): Promise<Release | null> {
  // Once per browser session, to stay well inside GitHub's rate limit.
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) return null;
  const data = await response.json();
  const release = { version: String(data.tag_name).replace(/^v/, ""), url: data.html_url };
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

/** A small link in the nav when a newer release is on GitHub. Only checks when allowed; silent offline. */
export default function UpdateNotice({ enabled }: { enabled: boolean }) {
  const [update, setUpdate] = useState<Release | null>(null);

  useEffect(() => {
    if (!enabled) return;
    Promise.all([api<{ version: string }>("/"), latestRelease()])
      .then(([running, latest]) => {
        if (latest && isNewer(latest.version, running.version)) setUpdate(latest);
      })
      .catch(() => {});
  }, [enabled]);

  if (!update || !enabled) return null;

  return (
    <a
      href={update.url}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20"
    >
      Update available: v{update.version}
    </a>
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
