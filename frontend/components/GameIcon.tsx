"use client";

import Image from "next/image";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

import { iconLabel, iconSrc } from "@/lib/data/icons";

/**
 * A bundled game icon (`<GameIcon name="ebony-cube" size={20} />`), or the
 * Lucide `fallback` when there's no file for it (or it fails to load), so the
 * app works with zero images. Fixed width and height: no layout shift.
 */
export default function GameIcon({
  name,
  size = 16,
  fallback: Fallback,
  alt,
  className = "",
}: {
  name: string;
  size?: number;
  fallback?: LucideIcon;
  /** Defaults to the icon's label; pass "" when the text beside it says the same. */
  alt?: string;
  className?: string;
}) {
  const src = iconSrc(name);
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === src) {
    return Fallback ? <Fallback size={size} className={className} aria-hidden /> : null;
  }
  return (
    <Image
      src={src}
      width={size}
      height={size}
      unoptimized
      loading="lazy"
      alt={alt ?? iconLabel(name)}
      onError={() => setFailed(src)}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
