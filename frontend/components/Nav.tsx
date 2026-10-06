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
        {/* On a phone the links get their own row, as icons; the current page keeps its label. */}
        <div className="order-last flex w-full flex-wrap gap-1 md:order-none md:w-auto">
          {links.map((link) => {
            const current = isCurrent(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.label}
                title={link.label}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm lg:px-3 ${
                  current ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2"
                }`}
              >
                <GameIcon name={link.icon} size={20} framed alt="" />
                <span className={current ? "" : "hidden lg:inline"}>{link.label}</span>
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
