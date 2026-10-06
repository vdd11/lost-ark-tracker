"use client";

import { useEffect } from "react";

import {
  applyAppearance,
  DENSITIES,
  DENSITY_LABELS,
  DENSITY_PREFERENCE,
  Density,
  TEXT_SIZE_LABELS,
  TEXT_SIZE_PREFERENCE,
  TEXT_SIZES,
  TextSize,
} from "@/lib/appearance";
import { usePreference } from "@/lib/usePreference";
import GameIcon from "@/components/GameIcon";

function Choice<T extends string>({ label, options, labels, value, onChange }: { label: string; options: readonly T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 text-sm text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-md border border-border p-0.5">
        {options.map((option) => (
          <button
            key={option}
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={`rounded px-3 py-1 text-sm ${value === option ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Text size and density for this browser. */
export default function AppearanceSection() {
  const [textSize, setTextSize] = usePreference<TextSize>(TEXT_SIZE_PREFERENCE, "default", TEXT_SIZES);
  const [density, setDensity] = usePreference<Density>(DENSITY_PREFERENCE, "comfortable", DENSITIES);

  useEffect(() => {
    applyAppearance(textSize, density);
  }, [textSize, density]);

  return (
    <section>
      <h2 className="flex items-center gap-2 mb-1 text-2xl font-bold">
          <GameIcon name="appearance" size={32} framed alt="" /> Appearance
        </h2>
      <p className="mb-4 text-sm text-muted">How big the text is and how much room things get. Saved in this browser.</p>
      <div className="space-y-3">
        <Choice label="Text size" options={TEXT_SIZES} labels={TEXT_SIZE_LABELS} value={textSize} onChange={setTextSize} />
        <Choice label="Density" options={DENSITIES} labels={DENSITY_LABELS} value={density} onChange={setDensity} />
      </div>
    </section>
  );
}
