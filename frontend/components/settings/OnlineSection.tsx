"use client";

import { ReactNode } from "react";

import { useUpdateCheck } from "@/components/UpdateNotice";
import { NEWS_PREFERENCE } from "@/lib/online";
import { usePreference } from "@/lib/usePreference";
import GameIcon from "@/components/GameIcon";

/**
 * The only things that go online, each with its own switch and exactly what
 * it contacts. Everything else stays on this computer.
 */
export default function OnlineSection() {
  const [updateCheck, setUpdateCheck] = useUpdateCheck();
  const [newsOn, setNewsOn] = usePreference<boolean>(NEWS_PREFERENCE, false);

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <GameIcon name="online" size={32} alt="" /> Online features
      </h2>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Your roster and gold never leave this computer. These optional features read public pages from the
        internet; nothing about you is sent. Saved in this browser.
      </p>
      <div className="space-y-2">
        <Toggle
          checked={updateCheck === "on"}
          onChange={(on) => setUpdateCheck(on ? "on" : "off")}
          title="Check for new versions"
        >
          Asks github.com for the latest release once per browser session and shows &quot;Update available&quot; in
          the menu.
        </Toggle>
        <Toggle checked={newsOn} onChange={setNewsOn} title="Lost Ark updates widget">
          Shows server status and official news on the tracker. While the tracker is open, the app reads
          playlostark.com&apos;s server status page and Steam&apos;s Lost Ark news every 10 minutes. Its &quot;On
          X&quot; tab loads posts from x.com only when you open it.
        </Toggle>
      </div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  children,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <label className="flex max-w-3xl cursor-pointer items-start gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{children}</span>
      </span>
    </label>
  );
}
