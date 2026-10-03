"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect } from "react";

import { usePreference } from "@/lib/usePreference";

type Theme = "system" | "light" | "dark";
const THEMES: readonly Theme[] = ["system", "light", "dark"];
const LABELS: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };
const ICONS = { system: Monitor, light: Sun, dark: Moon };

/** Cycles System → Light → Dark. The saved choice is applied before paint by layout.tsx. */
export default function ThemeToggle() {
  const [theme, setTheme] = usePreference<Theme>("theme", "system", THEMES);

  useEffect(() => {
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const Icon = ICONS[theme];

  return (
    <button
      onClick={() => setTheme(next)}
      title={`${LABELS[theme]} (click for ${LABELS[next].toLowerCase()})`}
      aria-label={`${LABELS[theme]}. Switch to ${LABELS[next].toLowerCase()}`}
      className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
    >
      <Icon size={16} />
    </button>
  );
}
