"use client";

import { Coins, Gem, LayoutGrid, Settings2, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import UpdateNotice from "@/components/UpdateNotice";
import { DEFAULT_HIDDEN_RAW, HIDDEN_PREFERENCE, PAGE_KEYS, parseHidden } from "@/lib/trackerView";
import { usePreference } from "@/lib/usePreference";

/** `key` marks pages that can be hidden under Customize on the tracker. */
const LINKS: { href: string; label: string; icon: typeof Coins; key?: string }[] = [
  { href: "/", label: "Tracker", icon: LayoutGrid },
  { href: "/raids", label: "Raids", icon: Swords },
  { href: "/gold", label: "Gold", icon: Coins, key: PAGE_KEYS.gold },
  { href: "/gems", label: "Gems", icon: Gem, key: PAGE_KEYS.gems },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function Nav() {
  // The static build uses trailing slashes (/gold/), so normalize before comparing.
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const [hiddenRaw] = usePreference<string>(HIDDEN_PREFERENCE, DEFAULT_HIDDEN_RAW);
  const hidden = parseHidden(hiddenRaw);
  // A hidden page still shows while you're on it, so a bookmark isn't a dead end.
  const links = LINKS.filter((link) => !link.key || !hidden.has(link.key) || pathname === link.href);

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold text-accent">Lost Ark Tracker</span>
        <div className="flex flex-wrap gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                pathname === link.href ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2"
              }`}
            >
              <link.icon size={16} />
              {link.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <UpdateNotice />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
