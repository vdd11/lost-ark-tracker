"use client";

import { Coins, Gem, LayoutGrid, Settings2, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import UpdateNotice from "@/components/UpdateNotice";

const LINKS = [
  { href: "/", label: "Tracker", icon: LayoutGrid },
  { href: "/raids", label: "Raids", icon: Swords },
  { href: "/gold", label: "Gold", icon: Coins },
  { href: "/gems", label: "Gems", icon: Gem },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function Nav() {
  // The static build uses trailing slashes (/gold/), so normalize before comparing.
  const pathname = usePathname().replace(/(.)\/$/, "$1");

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold text-accent">Lost Ark Tracker</span>
        <div className="flex flex-wrap gap-1">
          {LINKS.map((link) => (
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
