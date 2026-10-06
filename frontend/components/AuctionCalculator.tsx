"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import NumberInput from "@/components/NumberInput";
import { formatGold } from "@/lib/api";
import { auctionBids, auctionFormula, PARTY_SIZES } from "@/lib/auction";
import { usePreference } from "@/lib/usePreference";
import GameIcon from "@/components/GameIcon";

/** How much to bid on a raid drop: break-even and a bid that still leaves a profit. */
export default function AuctionCalculator() {
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <GameIcon name="auction" size={20} alt="" /> Auction calculator
      </h2>
      <p className="mb-3 text-xs text-muted">How much to bid on a raid drop so winning it is worth more than your share of someone else&apos;s bid.</p>
      <AuctionForm />
    </section>
  );
}

/** The calculator itself; `compact` keeps the working-out in a tooltip (tracker widget). */
export function AuctionForm({ compact = false }: { compact?: boolean }) {
  const [price, setPrice] = useState("");
  const [partySize, setPartySize] = usePreference<number>("auction-party-size", 8, PARTY_SIZES);
  const [resell, setResell] = usePreference<boolean>("auction-resell", true);
  const marketPrice = Number(price) || 0;
  const { breakEven, recommended } = auctionBids(marketPrice, partySize, resell);
  const formula = auctionFormula(marketPrice, partySize, resell);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Market price
          <NumberInput value={price} onChange={setPrice} placeholder="e.g. 12,000" aria-label="Market price" className="w-36 text-sm text-foreground" />
        </label>
        <div className="flex flex-col gap-1 text-xs text-muted">
          Party
          <div role="radiogroup" aria-label="Party size" className="flex rounded-md border border-border p-0.5">
            {PARTY_SIZES.map((size) => (
              <button
                key={size}
                role="radio"
                aria-checked={partySize === size}
                onClick={() => setPartySize(size)}
                className={`rounded px-3 py-1 text-sm ${partySize === size ? "bg-surface-2 font-medium text-foreground" : ""}`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm">
          <input type="checkbox" checked={resell} onChange={(e) => setResell(e.target.checked)} />
          I&apos;ll sell it (5% market fee)
        </label>
      </div>
      {marketPrice > 0 && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <span className="text-xs text-muted">Bid up to </span>
            <span className="text-xl font-semibold tabular-nums text-accent">{formatGold(recommended)}</span>
          </div>
          <div className="text-sm text-muted">
            Break-even <span className="tabular-nums text-foreground">{formatGold(breakEven)}</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted" title={formula}>
            <Info size={12} /> {compact ? "How?" : formula}
          </span>
        </div>
      )}
    </div>
  );
}
