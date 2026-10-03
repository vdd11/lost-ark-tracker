"use client";

import { useEffect } from "react";

import { usePreference } from "@/lib/usePreference";

type Theme = "system" | "light" | "dark";
const THEMES: readonly Theme[] = ["system", "light", "dark"];
const LABELS: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };
const ICONS: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

/** Cycles System → Light → Dark. The saved choice is applied before paint by layout.tsx. */
export default function ThemeToggle() {
  const [theme, setTheme] = usePreference<Theme>("theme", "system", THEMES);

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  return (
    <button
      onClick={() => setTheme(next)}
      title={`${LABELS[theme]} (click for ${LABELS[next].toLowerCase()})`}
      aria-label={`${LABELS[theme]}. Switch to ${LABELS[next].toLowerCase()}`}
      className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-2"
    >
      {ICONS[theme]}
    </button>
  );
}
