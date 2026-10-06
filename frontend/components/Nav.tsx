"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useShortcutHelp } from "@/components/KeyboardShortcuts";
import ThemeToggle from "@/components/ThemeToggle";
import UpdateNotice, { UpdateCheckPrompt, useUpdateCheck } from "@/components/UpdateNotice";
import { DEFAULT_HIDDEN_RAW, HIDDEN_PREFERENCE, PAGE_KEYS, parseHidden } from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";
import GameIcon from "@/components/GameIcon";
import SlotIcon from "@/components/SlotIcon";

/** `key` marks pages that can be hidden under Customize on the tracker. */
const LINKS: { href: string; label: string; icon: string; key?: string }[] = [
  { href: "/", label: "Tracker", icon: "tracker" },
  { href: "/gold", label: "Gold", icon: "gold", key: PAGE_KEYS.gold },
  { href: "/gems", label: "Gems", icon: "doomfire", key: PAGE_KEYS.gems },
  { href: "/tools", label: "Tools", icon: "tools", key: PAGE_KEYS.tools },
  { href: "/guides", label: "Guides", icon: "guides", key: PAGE_KEYS.guides },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export default function Nav() {
  // The static build uses trailing slashes (/gold/), so normalize before comparing.
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const [hiddenRaw] = usePreference<string>(HIDDEN_PREFERENCE, DEFAULT_HIDDEN_RAW);
  const hidden = parseHidden(hiddenRaw);
  // A hidden page still shows while you're on it, so a bookmark isn't a dead end.
  // A section's sub-pages (/tools/astrogems) count as being on it.
  const isCurrent = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const links = LINKS.filter((link) => !link.key || !hidden.has(link.key) || isCurrent(link.href));
  const [updateCheck, setUpdateCheck] = useUpdateCheck();
  const openShortcuts = useShortcutHelp();

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-accent">
          <SlotIcon glyph="slot" size={22} />
          Lost Ark Tracker
        </span>
        {/* On a phone the links are a bar along the bottom of the screen (icon over a short label). */}
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-surface px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:static md:z-auto md:flex-wrap md:justify-start md:gap-1 md:border-0 md:bg-transparent md:p-0"
          aria-label="Pages"
        >
          {links.map((link) => {
            const current = isCurrent(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.label}
                title={link.label}
                aria-current={current ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1 text-xs md:flex-none md:flex-row md:gap-1.5 md:px-2.5 md:py-1.5 md:text-sm lg:px-3 ${
                  current ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:bg-surface-2"
                }`}
              >
                <GameIcon name={link.icon} size={22} framed alt="" />
                <span className={current ? "" : "md:hidden lg:inline"}>{link.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <UpdateNotice enabled={updateCheck === "on"} />
          <button
            onClick={openShortcuts}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <GameIcon name="shortcuts" size={20} alt="" />
          </button>
          <ThemeToggle />
        </div>
      </nav>
      {updateCheck === "ask" && <UpdateCheckPrompt onChoose={setUpdateCheck} />}
    </header>
  );
}
