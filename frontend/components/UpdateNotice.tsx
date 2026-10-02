"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
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

/** A small link in the nav when a newer release is on GitHub. Silent offline. */
export default function UpdateNotice() {
  const [update, setUpdate] = useState<Release | null>(null);

  useEffect(() => {
    Promise.all([api<{ version: string }>("/"), latestRelease()])
      .then(([running, latest]) => {
        if (latest && isNewer(latest.version, running.version)) setUpdate(latest);
      })
      .catch(() => {});
  }, []);

  if (!update) return null;

  return (
    <a
      href={update.url}
      target="_blank"
      rel="noreferrer"
      className="ml-auto rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20"
    >
      Update available: v{update.version}
    </a>
  );
}
