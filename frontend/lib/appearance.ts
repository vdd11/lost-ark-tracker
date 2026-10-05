/**
 * Text size and density (Settings → Appearance), saved per browser and
 * applied as data attributes on <html> (see globals.css, and layout.tsx,
 * which applies them before the first paint).
 */
export const TEXT_SIZES = ["small", "default", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export const TEXT_SIZE_PREFERENCE = "text-size";
export const DENSITY_PREFERENCE = "density";

export const TEXT_SIZE_LABELS: Record<TextSize, string> = { small: "Small", default: "Default", large: "Large" };
export const DENSITY_LABELS: Record<Density, string> = { comfortable: "Comfortable", compact: "Compact" };

/** The attributes for a choice; the defaults leave the attribute off. */
export function appearanceAttributes(textSize: TextSize, density: Density): Record<string, string | null> {
  return {
    "data-text-size": textSize === "default" ? null : textSize,
    "data-density": density === "comfortable" ? null : density,
  };
}

export function applyAppearance(textSize: TextSize, density: Density, root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(appearanceAttributes(textSize, density))) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}
