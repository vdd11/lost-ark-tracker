"use client";

import Image from "next/image";
import { useState } from "react";

import SlotIcon, { SlotGlyphIcon } from "@/components/SlotIcon";
import { iconLabel, iconSrc, slotGlyphFor } from "@/lib/data/icons";

/**
 * One icon language for the app (`<GameIcon name="ebony-cube" size={20} />`):
 * the bundled game icon when there's a file for it, otherwise its original
 * glyph in an inventory-slot tile (lib/data/icons.ts SLOT_GLYPHS), so nothing
 * ever shows a bare generic icon. Fixed width and height: no layout shift.
 */
export default function GameIcon({
  name,
  size = 16,
  alt,
  className = "",
  framed = false,
  inline = false,
}: {
  name: string;
  size?: number;
  /** Defaults to the icon's label; pass "" when the text beside it says the same. */
  alt?: string;
  className?: string;
  /** Put a game image in a slot tile too (card headers, boxes, widgets, the menu). */
  framed?: boolean;
  /** Beside text at 12-16px: a glyph without its tile, in gold. */
  inline?: boolean;
}) {
  const src = iconSrc(name);
  const [failed, setFailed] = useState<string | null>(null);
  const label = alt ?? iconLabel(name);

  if (!src || failed === src) {
    const glyph = slotGlyphFor(name);
    if (!glyph) return null;
    if (inline) return <SlotGlyphIcon glyph={glyph} size={size} className={`text-accent ${className}`} />;
    return <SlotIcon glyph={glyph} size={size} label={label || undefined} />;
  }

  const imageSize = framed ? Math.round(size * 0.8) : size;
  const image = (
    <Image
      src={src}
      width={imageSize}
      height={imageSize}
      unoptimized
      loading="lazy"
      alt={label}
      onError={() => setFailed(src)}
      // Class emblems are pale, like in game: a dark backdrop keeps them visible on light pages.
      className={`shrink-0 object-contain ${!framed && name.startsWith("class-") ? "rounded-md bg-[#1d2229] p-px" : ""} ${framed ? "" : className}`}
      style={{ width: imageSize, height: imageSize }}
    />
  );
  if (!framed) return image;
  return (
    <span className={`slot-tile inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {image}
    </span>
  );
}
