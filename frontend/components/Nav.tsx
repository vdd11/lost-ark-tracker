"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import UpdateNotice from "@/components/UpdateNotice";

const LINKS = [
  { href: "/", label: "Tracker" },
  { href: "/raids", label: "Raids" },
  { href: "/gold", label: "Gold" },
  { href: "/gems", label: "Gems" },
  { href: "/settings", label: "Settings" },
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
              className={`rounded px-3 py-1.5 text-sm ${
                pathname === link.href ? "bg-surface-2 font-medium" : "text-muted hover:bg-surface-2"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <UpdateNotice />
      </nav>
    </header>
  );
}
