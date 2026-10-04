"use client";

import { BookOpen, Coins, Gem, Keyboard, LayoutGrid, Settings2, Swords, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useShortcutHelp } from "@/components/KeyboardShortcuts";
import ThemeToggle from "@/components/ThemeToggle";
import UpdateNotice, { UpdateCheckPrompt, useUpdateCheck } from "@/components/UpdateNotice";
import { DEFAULT_HIDDEN_RAW, HIDDEN_PREFERENCE, PAGE_KEYS, parseHidden } from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";

/** `key` marks pages that can be hidden under Customize on the tracker. */
const LINKS: { href: string; label: string; icon: typeof Coins; key?: string }[] = [
  { href: "/", label: "Tracker", icon: LayoutGrid },
  { href: "/raids", label: "Raids", icon: Swords },
  { href: "/gold", label: "Gold", icon: Coins, key: PAGE_KEYS.gold },
  { href: "/gems", label: "Gems", icon: Gem, key: PAGE_KEYS.gems },
  { href: "/tools", label: "Tools", icon: Wrench, key: PAGE_KEYS.tools },
  { href: "/guides", label: "Guides", icon: BookOpen, key: PAGE_KEYS.guides },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function Nav() {
  // The static build uses trailing slashes (/gold/), so normalize before comparing.
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const [hiddenRaw] = usePreference<string>(HIDDEN_PREFERENCE, DEFAULT_HIDDEN_RAW);
  const hidden = parseHidden(hiddenRaw);
  // A hidden page still shows while you're on it, so a bookmark isn't a dead end.
  // A section's sub-pages (/tools/prices) count as being on it.
  const isCurrent = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const links = LINKS.filter((link) => !link.key || !hidden.has(link.key) || isCurrent(link.href));
  const [updateCheck, setUpdateCheck] = useUpdateCheck();
  const openShortcuts = useShortcutHelp();

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold text-accent">Lost Ark Tracker</span>
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
                <link.icon size={16} />
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
            <Keyboard size={18} />
          </button>
          <ThemeToggle />
        </div>
      </nav>
      {updateCheck === "ask" && <UpdateCheckPrompt onChoose={setUpdateCheck} />}
    </header>
  );
}
