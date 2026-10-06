"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { describeError } from "@/components/ErrorBanner";
import GameIcon from "@/components/GameIcon";
import AddCharacterForm from "@/components/settings/AddCharacterForm";
import PasteRoster from "@/components/settings/PasteRoster";
import StyleChooser from "@/components/tracker/StyleChooser";
import { TrackerData } from "@/components/tracker/useTrackerData";
import { TrackerView } from "@/components/tracker/useTrackerView";
import { send } from "@/lib/api";
import { classIconName } from "@/lib/data/icons";
import { earnersByAccount } from "@/lib/firstRun";
import { formatItemLevel, isActiveRaid } from "@/lib/raids";

const STEPS = ["How much to track", "Add your characters", "Who earns gold"];

/**
 * The first visit: pick a play style, add the roster (paste it or one by
 * one), then choose the gold earners. Shown until finished or skipped.
 */
export default function FirstRun({ data, view, onStart, onFinish }: { data: TrackerData; view: TrackerView; onStart: () => void; onFinish: () => void }) {
  const characters = data.allCharacters;
  // Coming back mid-way (after a reload), pick up at the roster.
  const [step, setStep] = useState(characters.length > 0 ? 1 : 0);
  const raids = data.tasks.filter((t) => isActiveRaid(t));
  const go = (next: number) => {
    onStart();
    setStep(next);
  };

  return (
    <section className="rounded-lg border border-accent/40 bg-surface p-4" aria-labelledby="first-run-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="first-run-title" className="text-lg font-semibold">Welcome! Let&apos;s set up your roster</h2>
          <p className="text-sm text-muted">Three quick steps. Everything stays on this computer, and you can change it all later.</p>
        </div>
        <button onClick={onFinish} className="shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2">
          Skip setup
        </button>
      </div>

      <ol className="mb-4 flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              onClick={() => go(index)}
              aria-current={step === index ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                step === index ? "border-accent bg-accent/15 font-medium" : "border-border text-muted hover:text-foreground"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${index < step ? "bg-done text-background" : "bg-surface-2"}`}>
                {index < step ? <Check size={12} /> : index + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Pick a starting point. You can fine-tune anything later under Customize.</p>
          <StyleChooser
            current={null}
            onChoose={(style) => {
              view.applyStyle(style);
              go(1);
            }}
          />
          <button onClick={() => go(1)} className="text-sm text-muted underline hover:text-foreground">
            Keep the default and continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Paste your roster (a line per character: name, class, item level), or add characters one at a time. Their usual
            raids are picked from their item level.
          </p>
          <PasteRoster accounts={data.accounts} characters={characters} raids={raids} onDone={data.reload} onError={data.setError} />
          <AddCharacterForm
            accounts={data.accounts.length > 1 ? data.accounts : []}
            raids={raids}
            onAdd={async (body) => {
              try {
                await send("POST", "/characters", body);
                data.reload();
              } catch (e) {
                data.setError(describeError(e));
              }
            }}
          />
          {characters.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Characters added">
              {characters.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-md border border-border bg-surface-2/50 px-2 py-1 text-sm">
                  <GameIcon name={classIconName(c.class_name)} size={28} rem alt="" />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted">
                    {c.class_name} · {formatItemLevel(c.item_level)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => go(2)}
            disabled={characters.length === 0}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
          >
            Next: who earns gold
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Up to 6 characters per account are paid raid gold, for 3 raids a week each. The others still clear raids, and their
            bonus boxes are free for 3 raids a week.
          </p>
          {earnersByAccount(characters, data.accounts).map((group) => (
            <div key={group.name}>
              <p className={`mb-1 text-sm font-medium ${group.earners > group.max ? "text-danger" : ""}`}>
                {group.name}: {group.earners} of {group.max} gold earners
              </p>
              <ul className="flex flex-wrap gap-2">
                {group.characters.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => data.actions.setGoldEarner(c, !c.is_gold_earner)}
                      aria-pressed={c.is_gold_earner}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                        c.is_gold_earner ? "border-accent bg-accent/15" : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      <GameIcon name={classIconName(c.class_name)} size={28} rem alt="" />
                      {c.name}
                      <span className={`rounded px-1.5 text-xs font-semibold ${c.is_gold_earner ? "bg-accent/20 text-accent" : "border border-dashed border-border"}`}>
                        GOLD
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button onClick={onFinish} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background">
            Done: show my tracker
          </button>
        </div>
      )}
    </section>
  );
}
