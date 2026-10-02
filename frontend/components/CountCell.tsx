"use client";

import { Character, Difficulty, Task } from "@/lib/api";
import { formatItemLevel } from "@/lib/raids";

/** Runs this week for content limited by tickets (Ebony Cube), at the character's tier. */
export default function CountCell({
  task,
  character,
  tier,
  count,
  onSet,
}: {
  task: Task;
  character: Character;
  tier: Difficulty | undefined;
  count: number;
  onSet: (count: number) => void;
}) {
  const label = `${task.name} runs for ${character.name}`;
  const button = "h-6 w-6 rounded text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30";

  return (
    <div className={count > 0 ? "bg-done/15" : ""}>
      <div className="flex h-7 items-end justify-center gap-1">
        <button onClick={() => onSet(count - 1)} disabled={count === 0} aria-label={`One fewer ${label}`} className={button}>
          −
        </button>
        <span className="min-w-4 pb-0.5 tabular-nums" aria-label={`${count} ${label}`}>{count}</span>
        <button onClick={() => onSet(count + 1)} aria-label={`One more ${label}`} className={button}>
          +
        </button>
      </div>
      {tier && (
        <div className="pb-1.5 pt-1 text-[11px] leading-none text-muted" title={`${tier.name} unlock (${formatItemLevel(tier.min_item_level)})`}>
          {tier.name}
        </div>
      )}
    </div>
  );
}
