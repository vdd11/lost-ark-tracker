"use client";

import { ArrowLeft, Plus, Tags } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import { PageSkeleton } from "@/components/Skeleton";
import GuideLink from "@/components/guides/GuideLink";
import { useUndo } from "@/components/Toast";
import PriceRow, { PriceChange } from "@/components/tools/PriceRow";
import { api, API_URL, send } from "@/lib/api";
import { parsePrice, Price, STALE_AFTER_DAYS } from "@/lib/prices";

export default function PricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Until the first load finishes (or fails), show a skeleton instead of empty states.
  const [loaded, setLoaded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [now] = useState(() => new Date());
  const offerUndo = useUndo();

  const load = useCallback(() => {
    api<Price[]>("/prices")
      .then((data) => {
        setPrices(data);
        setError(null);
        setLoaded(true);
      })
      .catch((e) => {
        setError(describeError(e));
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (e) {
      setError(describeError(e));
    }
    load();
  }

  function change(item: Price, data: PriceChange) {
    run(() => send("PATCH", `/prices/${item.key}`, data));
  }

  function remove(item: Price) {
    run(async () => {
      await send("DELETE", `/prices/${item.key}`);
      offerUndo(item.builtin ? `${item.name} reset` : `${item.name} deleted`, async () => {
        if (item.builtin) await send("PATCH", `/prices/${item.key}`, { price: item.price, per: item.per, hidden: item.hidden });
        else await send("POST", "/prices", { name: item.name, price: item.price, per: item.per });
        load();
      });
    });
  }

  function add(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    run(() => send("POST", "/prices", { name: newName.trim(), price: parsePrice(newPrice) }));
    setNewName("");
    setNewPrice("");
  }

  const shown = prices.filter((p) => showHidden || !p.hidden);
  const hiddenCount = prices.filter((p) => p.hidden).length;

  if (!loaded) return <PageSkeleton title="Prices" />;

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div>
        <Link href="/tools" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={14} /> Tools
        </Link>
        <div className="mb-1 flex flex-wrap items-baseline gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Tags size={22} /> Prices
          </h1>
          <GuideLink id="maxroll-gold" label="Gold and silver guide" />
        </div>
        <p className="text-sm text-muted">
          What items cost on the market, as you see them in game. The honing and astrogem tools use these to put a gold
          value on materials. Type the price of a listing and how many units it&apos;s for (the market sells some items in
          bundles). Nothing is looked up online. Prices older than {STALE_AFTER_DAYS} days are marked.
        </p>
      </div>

      <section className="overflow-x-auto rounded-md border border-border bg-surface p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="w-full py-1 pr-2 font-medium">Item</th>
              <th className="py-1 pr-2 text-right font-medium">Price (gold)</th>
              <th className="py-1 pr-2 text-right font-medium">For units</th>
              <th className="py-1 pr-2 text-right font-medium">Per unit</th>
              <th className="py-1 pr-2 font-medium">Updated</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <PriceRow
                key={`${item.key}:${item.price}:${item.per}:${item.name}`}
                item={item}
                now={now}
                onChange={(data) => change(item, data)}
                onRemove={() => remove(item)}
              />
            ))}
          </tbody>
        </table>

        <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add an item" aria-label="New item name" />
          <input
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Price"
            aria-label="New item price"
            className="w-28"
          />
          <button type="submit" disabled={!newName.trim()} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50">
            <Plus size={14} /> Add
          </button>
          <span className="ml-auto flex items-center gap-3">
            {hiddenCount > 0 && (
              <label className="flex items-center gap-1.5 text-muted">
                <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
                Show hidden ({hiddenCount})
              </label>
            )}
            <a href={`${API_URL}/export/prices.csv`} download className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
              Export CSV
            </a>
          </span>
        </form>
      </section>
    </div>
  );
}
