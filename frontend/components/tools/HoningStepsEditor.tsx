"use client";

import { Plus, Trash2 } from "lucide-react";

import { HoningPlan, HoningStep, newStep } from "@/lib/honing";
import { Price } from "@/lib/prices";

/** A number field that treats empty as `empty` (0 or null). */
function Num({
  value,
  onChange,
  label,
  empty = 0,
  max,
  className = "w-20",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  empty?: 0 | null;
  max?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      step="any"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? empty : Math.max(0, Number(e.target.value)))}
      aria-label={label}
      className={`${className} text-right tabular-nums`}
    />
  );
}

/**
 * The plan's upgrade steps, one row each, with the numbers from the in-game
 * honing panel, plus how much of each material the user already has.
 */
export default function HoningStepsEditor({
  plan,
  prices,
  onChange,
}: {
  plan: HoningPlan;
  prices: Price[];
  onChange: (plan: HoningPlan) => void;
}) {
  const used = [...new Set(plan.steps.flatMap((s) => Object.keys(s.materials)))];
  const materials = [...used, ...Object.keys(plan.owned).filter((k) => !used.includes(k))];
  const nameOf = (key: string) => prices.find((p) => p.key === key)?.name ?? key;
  const addable = prices.filter((p) => !p.hidden && !materials.includes(p.key));

  const setStep = (id: string, change: Partial<HoningStep>) =>
    onChange({ ...plan, steps: plan.steps.map((s) => (s.id === id ? { ...s, ...change } : s)) });

  function addStep() {
    const id = `s${Date.now().toString(36)}`;
    const template = plan.steps.at(-1);
    // A new row starts with the previous one's materials, which is usually what's next.
    const step = template ? { ...template, id, label: "" } : newStep(id);
    onChange({ ...plan, steps: [...plan.steps, step] });
  }

  function addMaterial(key: string) {
    if (!key) return;
    onChange({ ...plan, owned: { ...plan.owned, [key]: plan.owned[key] ?? 0 } });
  }

  function removeMaterial(key: string) {
    const owned = { ...plan.owned };
    delete owned[key];
    onChange({
      steps: plan.steps.map((s) => {
        const rest = { ...s.materials };
        delete rest[key];
        return { ...s, materials: rest };
      }),
      owned,
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-2 font-medium">Upgrade</th>
            <th className="py-1 pr-2 text-right font-medium" title="How many times you'll do this upgrade">Times</th>
            <th className="py-1 pr-2 text-right font-medium" title="Success chance of the first attempt">Chance %</th>
            <th className="py-1 pr-2 text-right font-medium" title="Points the chance goes up after each failure, if the game shows it">+% per fail</th>
            <th className="py-1 pr-2 text-right font-medium" title="Highest the chance can go (blank: no limit)">Max %</th>
            <th className="py-1 pr-2 text-right font-medium" title="The attempt that always succeeds, if the game shows one">Sure by try</th>
            <th className="py-1 pr-2 text-right font-medium">Gold / try</th>
            <th className="py-1 pr-2 text-right font-medium">Silver / try</th>
            {materials.map((key) => (
              <th key={key} className="py-1 pr-2 text-right font-medium">
                <span className="inline-flex items-center gap-1">
                  {nameOf(key)} / try
                  <button onClick={() => removeMaterial(key)} aria-label={`Remove ${nameOf(key)}`} className="rounded p-0.5 hover:text-danger">
                    <Trash2 size={11} />
                  </button>
                </span>
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {plan.steps.map((step, index) => (
            <tr key={step.id} className="border-t border-border">
              <td className="py-1 pr-2">
                <input
                  value={step.label}
                  onChange={(e) => setStep(step.id, { label: e.target.value })}
                  placeholder={`Step ${index + 1}, e.g. armor +14`}
                  aria-label={`Step ${index + 1} name`}
                  maxLength={100}
                  className="w-44"
                />
              </td>
              <td className="py-1 pr-2"><Num value={step.count} onChange={(v) => setStep(step.id, { count: Math.round(v ?? 0) })} label={`Step ${index + 1} times`} className="w-16" /></td>
              <td className="py-1 pr-2"><Num value={step.chance} max={100} onChange={(v) => setStep(step.id, { chance: Math.min(100, v ?? 0) })} label={`Step ${index + 1} chance`} /></td>
              <td className="py-1 pr-2"><Num value={step.chanceStep} max={100} onChange={(v) => setStep(step.id, { chanceStep: Math.min(100, v ?? 0) })} label={`Step ${index + 1} chance added per failure`} /></td>
              <td className="py-1 pr-2"><Num value={step.chanceCap} empty={null} max={100} onChange={(v) => setStep(step.id, { chanceCap: v == null ? null : Math.min(100, v) })} label={`Step ${index + 1} maximum chance`} /></td>
              <td className="py-1 pr-2"><Num value={step.guaranteedBy} empty={null} onChange={(v) => setStep(step.id, { guaranteedBy: v == null || v < 1 ? null : Math.round(v) })} label={`Step ${index + 1} guaranteed by attempt`} /></td>
              <td className="py-1 pr-2"><Num value={step.gold} onChange={(v) => setStep(step.id, { gold: v ?? 0 })} label={`Step ${index + 1} gold per attempt`} className="w-24" /></td>
              <td className="py-1 pr-2"><Num value={step.silver} onChange={(v) => setStep(step.id, { silver: v ?? 0 })} label={`Step ${index + 1} silver per attempt`} className="w-28" /></td>
              {materials.map((key) => (
                <td key={key} className="py-1 pr-2">
                  <Num
                    value={step.materials[key] ?? 0}
                    onChange={(v) => setStep(step.id, { materials: { ...step.materials, [key]: v ?? 0 } })}
                    label={`Step ${index + 1} ${nameOf(key)} per attempt`}
                    className="w-24"
                  />
                </td>
              ))}
              <td className="py-1 text-right">
                <button
                  onClick={() => onChange({ ...plan, steps: plan.steps.filter((s) => s.id !== step.id) })}
                  aria-label={`Delete step ${index + 1}`}
                  className="rounded p-1 text-muted hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
          {materials.length > 0 && (
            <tr className="border-t border-border text-muted">
              <td className="py-1 pr-2 text-xs" colSpan={8}>
                You already have
              </td>
              {materials.map((key) => (
                <td key={key} className="py-1 pr-2">
                  <Num
                    value={plan.owned[key] ?? 0}
                    onChange={(v) => onChange({ ...plan, owned: { ...plan.owned, [key]: v ?? 0 } })}
                    label={`${nameOf(key)} you already have`}
                    className="w-24"
                  />
                </td>
              ))}
              <td />
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={addStep} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
          <Plus size={14} /> Add step
        </button>
        {addable.length > 0 && (
          <select value="" onChange={(e) => addMaterial(e.target.value)} aria-label="Add a material column">
            <option value="">+ Material…</option>
            {addable.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
