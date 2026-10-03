"use client";

import { ExternalLink, Newspaper } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, NewsFeed, ServerStatus } from "@/lib/api";
import { usePreference } from "@/lib/usePreference";

const REFRESH_MS = 10 * 60 * 1000;
const TABS = ["servers", "news", "x"] as const;
type Tab = (typeof TABS)[number];
const X_ACCOUNTS = [
  { handle: "LAGameStatus", label: "Game status" },
  { handle: "playlostark", label: "Lost Ark" },
] as const;
const X_HANDLES = X_ACCOUNTS.map((a) => a.handle);

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  good: { dot: "bg-done", label: "Online" },
  busy: { dot: "bg-accent", label: "Busy" },
  full: { dot: "bg-danger", label: "Full" },
  maintenance: { dot: "bg-muted", label: "Maintenance" },
};

declare global {
  interface Window {
    twttr?: { widgets?: { load: (element?: HTMLElement) => void } };
  }
}

/**
 * Official Lost Ark updates: live server status and announcements (fetched
 * by the app from playlostark.com and Steam), and the official X accounts.
 * X only loads when its tab is opened.
 */
export default function NewsWidget() {
  const [tab, setTab] = usePreference<Tab>("news-tab", "servers", TABS);
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = () =>
      api<NewsFeed>("/news")
        .then((data) => {
          setFeed(data);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const tabButton = (id: Tab, label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`rounded-md px-2 py-0.5 text-xs ${tab === id ? "bg-accent/15 font-medium" : "text-muted hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Newspaper size={16} />
          </span>
          Lost Ark updates
        </h2>
        <div role="tablist" className="flex gap-0.5">
          {tabButton("servers", "Servers")}
          {tabButton("news", "News")}
          {tabButton("x", "On X")}
        </div>
      </header>

      {tab === "x" ? (
        <XTimeline />
      ) : failed && !feed ? (
        <p className="text-sm text-muted">Couldn&apos;t load updates. Check your internet connection.</p>
      ) : !feed ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tab === "servers" ? (
        <Servers servers={feed.servers} error={feed.servers_error} />
      ) : (
        <News feed={feed} />
      )}
    </section>
  );
}

function Servers({ servers, error }: { servers: ServerStatus[]; error: string | null }) {
  if (error || servers.length === 0) {
    return <p className="text-sm text-muted">{error ?? "No servers listed right now."}</p>;
  }
  const regions = [...new Set(servers.map((s) => s.region))];
  const problems = servers.filter((s) => s.status !== "good");
  return (
    <div className="space-y-3 text-sm">
      <p className={`text-xs font-medium ${problems.length ? "text-accent" : "text-done"}`}>
        {problems.length === 0
          ? "All servers online"
          : problems.map((s) => `${s.name}: ${STATUS_STYLE[s.status]?.label ?? s.status}`).join(" · ")}
      </p>
      {regions.map((region) => (
        <div key={region}>
          <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{region}</h3>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {servers
              .filter((s) => s.region === region)
              .map((server) => {
                const style = STATUS_STYLE[server.status] ?? { dot: "bg-muted", label: server.status };
                return (
                  <li key={server.name} className="flex items-center gap-1.5" title={style.label}>
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                    {server.name}
                    <span className="sr-only">: {style.label}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <a
        href="https://www.playlostark.com/en-us/support/server-status"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-[11px] text-muted underline hover:text-foreground"
      >
        Official status page <ExternalLink size={11} />
      </a>
    </div>
  );
}

function News({ feed }: { feed: NewsFeed }) {
  if (feed.news_error || feed.news.length === 0) {
    return <p className="text-sm text-muted">{feed.news_error ?? "No announcements yet."}</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {feed.news.slice(0, 5).map((item) => (
        <li key={item.url}>
          <a href={item.url} target="_blank" rel="noreferrer" className="group block">
            <span className="line-clamp-2 group-hover:underline">{item.title}</span>
            <span className="text-[11px] text-muted">
              {new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** An official X timeline via X's own embed; X may ask you to sign in to show posts. */
function XTimeline() {
  const [handle, setHandle] = usePreference<string>("news-x-account", X_HANDLES[0], X_HANDLES);
  const box = useRef<HTMLDivElement>(null);
  // The handle whose embed X didn't render (it often needs you signed in to x.com).
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const check = setTimeout(() => {
      // Signed out, X loads its frame but keeps it hidden at zero height.
      const frame = element.querySelector("iframe");
      if (!frame || frame.offsetHeight < 40) setBlocked(handle);
    }, 8000);
    const dark = document.documentElement.dataset.theme === "dark" ||
      (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    element.innerHTML = "";
    const link = document.createElement("a");
    link.href = `https://twitter.com/${handle}`;
    link.dataset.height = "360";
    link.dataset.dnt = "true";
    link.dataset.chrome = "noheader nofooter transparent";
    link.dataset.theme = dark ? "dark" : "light";
    link.textContent = `Loading posts from @${handle}…`;
    link.className = "twitter-timeline text-muted";
    element.appendChild(link);

    if (window.twttr?.widgets) {
      window.twttr.widgets.load(element);
    } else if (!document.getElementById("x-widgets")) {
      const script = document.createElement("script");
      script.id = "x-widgets";
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      document.body.appendChild(script);
    }
    return () => clearTimeout(check);
  }, [handle]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {X_ACCOUNTS.map((account) => (
          <button
            key={account.handle}
            onClick={() => setHandle(account.handle)}
            aria-pressed={handle === account.handle}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              handle === account.handle ? "border-accent bg-accent/15 font-medium" : "border-border text-muted hover:text-foreground"
            }`}
          >
            @{account.handle}
          </button>
        ))}
      </div>
      <div ref={box} className={`max-h-[360px] overflow-y-auto text-sm ${blocked === handle ? "hidden" : ""}`} />
      {blocked === handle && (
        <p className="text-sm text-muted">
          X didn&apos;t show posts here. It usually only does when you&apos;re signed in to x.com in this browser.
        </p>
      )}
      <a
        href={`https://x.com/${handle}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-[11px] text-muted underline hover:text-foreground"
      >
        Open @{handle} on X <ExternalLink size={11} />
      </a>
    </div>
  );
}
