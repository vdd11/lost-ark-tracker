import { ReactNode } from "react";

import { SlotGlyph } from "@/lib/data/icons";

/**
 * Original glyphs for features with no game icon, all in one style: a 24-unit
 * grid, 1.75 stroke, round caps and joins, drawn in currentColor. Shown in an
 * inventory-slot tile (SlotIcon) like the game's item slots.
 */
const GLYPHS: Record<SlotGlyph, ReactNode> = {
  banner: (
    <>
      <path d="M6 3v18" />
      <path d="M6 4h12l-3 3.5L18 11H6" />
    </>
  ),
  anvil: (
    <>
      <path d="M3 7h12c.5 2 2.5 3 6 3v1.5c-3 0-5 1-6.5 3h-5C8 12 6 11 3 10.5z" />
      <path d="M9 14.5 8 18h8l-1-3.5" />
      <path d="M5.5 20.5h13" />
    </>
  ),
  tome: (
    <>
      <path d="M5 18V5.5A1.5 1.5 0 0 1 6.5 4H19v14H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h12v-4" />
      <path d="M12 7.5 14 10l-2 2.5-2-2.5z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 5.5 2.2 6.5L12 18.5 9.8 12z" />
      <path d="M12 3.5v-.5M12 21v-.5M3.5 12H3M21 12h-.5" />
    </>
  ),
  keycap: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <rect x="7" y="8" width="10" height="6.5" rx="1.5" />
    </>
  ),
  swords: (
    <>
      <path d="M5 5l10 10M19 5 9 15" />
      <path d="M13 17l4-4M7 13l4 4" />
      <path d="m16 16 3 3M8 16l-3 3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  scroll: (
    <>
      <path d="M8 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8" />
      <path d="M8 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2zM8 20a2 2 0 0 1-2-2v-1" />
      <path d="M11 9h5M11 12h5M11 15h3" />
    </>
  ),
  ledger: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M6 20.5V14M10 20.5V9M14 20.5v-8M18 20.5V5" />
    </>
  ),
  chest: (
    <>
      <path d="M4 11a8 5 0 0 1 16 0v8H4z" />
      <path d="M4 13h16" />
      <path d="M12 12v3" />
    </>
  ),
  hourglass: (
    <>
      <path d="M7 3h10M7 21h10" />
      <path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
    </>
  ),
  gavel: (
    <>
      <path d="m13.5 3.5 5 5-3 3-5-5z" />
      <path d="m12 10-7 7 2 2 7-7" />
      <path d="M4 21h9" />
    </>
  ),
  herald: (
    <>
      <path d="M5 6h12v12a2 2 0 0 0 2 2H7a2 2 0 0 1-2-2z" />
      <path d="M17 9h2v9a2 2 0 0 1-2 2" />
      <path d="M8 9.5h6M8 12.5h6M8 15.5h3" />
    </>
  ),
  tally: (
    <>
      <path d="M6 6v12M10 6v12M14 6v12M18 6v12" />
      <path d="m4 16 16-8" />
    </>
  ),
  shields: (
    <>
      <path d="M12 5l5 2v4.5c0 3.5-2.5 6-5 7-2.5-1-5-3.5-5-7V7z" />
      <path d="M7.5 8.5 4 10v2.5c0 2.5 1.5 4.5 3.5 5.5M16.5 8.5 20 10v2.5c0 2.5-1.5 4.5-3.5 5.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16v-5a5.5 5.5 0 0 1 11 0v5l1.5 2h-14z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  "log-search": (
    <>
      <path d="M14 11V4H6v16h6" />
      <path d="M8.5 8h3M8.5 11h2" />
      <circle cx="16" cy="16" r="3" />
      <path d="m18.2 18.2 2.3 2.3" />
    </>
  ),
  beacon: (
    <>
      <path d="m12 10-3 11h6z" />
      <circle cx="12" cy="8" r="1.5" />
      <path d="M8.5 5a5 5 0 0 1 7 0M6 2.5a8.5 8.5 0 0 1 12 0" />
    </>
  ),
  purse: (
    <>
      <path d="M8.5 8c-2 2-3.5 4.5-3.5 7.5a7 5 0 0 0 14 0c0-3-1.5-5.5-3.5-7.5z" />
      <path d="M8.5 8h7M9.5 8 8 4.5h8L14.5 8" />
      <path d="M12 12v4.5" />
    </>
  ),
  chronicle: (
    <>
      <path d="M5 4h14v16H7a2 2 0 0 1-2-2z" />
      <path d="M5 16a2 2 0 0 1 2-2h12" />
      <path d="M13 4v6.5l2-1.5 2 1.5V4" />
    </>
  ),
  star: <path d="m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />,
  portal: <path d="M12 12a1.5 1.5 0 1 1 3 0 4 4 0 0 1-7 2 5.5 5.5 0 0 1 9.5-6A7.5 7.5 0 0 1 9 19.5 9 9 0 0 1 4.5 7" />,
  skull: (
    <>
      <path d="M7 14a5 5 0 1 1 10 0v2.5h-2V19H9v-2.5H7z" />
      <path d="M7.5 10 4 5.5l1 5.5M16.5 10 20 5.5 19 11" />
      <circle cx="10" cy="13.5" r=".8" />
      <circle cx="14" cy="13.5" r=".8" />
    </>
  ),
  gate: (
    <>
      <path d="M5 21V10.5a7 7 0 0 1 14 0V21" />
      <path d="M3 21h18" />
      <path d="M12 14a1 1 0 1 1 1.5 1 2.5 2.5 0 0 1-4-1 3.5 3.5 0 0 1 6-2" />
    </>
  ),
  flame: <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2-6 .8 1 1.5 2 1.5 3.5C11 8 11.5 5 12 3z" />,
  "chest-star": (
    <>
      <path d="M4 11a8 5 0 0 1 16 0v8H4z" />
      <path d="M4 13h16" />
      <path d="m12 14.5.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.8-1.4.8.3-1.5-1.1-1 1.5-.2z" />
    </>
  ),
  slot: <path d="m12 4 7 8-7 8-7-8z" />,
};

/** Just the glyph, for inline use beside text (12-16px). */
export function SlotGlyphIcon({ glyph, size = 16, className = "" }: { glyph: SlotGlyph; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {GLYPHS[glyph]}
    </svg>
  );
}

/**
 * A glyph in an inventory-slot tile: dark, with a thin gold bevel and a soft
 * inner glow, the glyph in gold (the same tile the class emblems sit on).
 * Reads in both themes, at 20px (nav), 24px (stats, widgets) and 32px (cards).
 */
export default function SlotIcon({ glyph, size = 24, label }: { glyph: SlotGlyph; size?: number; label?: string }) {
  return (
    <span
      className="slot-tile inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <SlotGlyphIcon glyph={glyph} size={Math.round(size * 0.66)} />
    </span>
  );
}
