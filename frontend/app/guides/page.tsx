"use client";

import { Plus, RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import ErrorBanner, { describeError } from "@/components/ErrorBanner";
import { PageSkeleton } from "@/components/Skeleton";
import GuideCard from "@/components/guides/GuideCard";
import GuideLinkForm, { GuideLinkDraft } from "@/components/guides/GuideLinkForm";
import { useUndo } from "@/components/Toast";
import { api, send } from "@/lib/api";
import {
  BUILT_IN_GUIDES,
  categoriesOf,
  categorySlug,
  filterGuides,
  fromLink,
  Guide,
  GuideLink,
  GUIDES_CHECKED,
} from "@/lib/guides";
import GameIcon from "@/components/GameIcon";

type GuidesData = { links: GuideLink[]; hidden: string[] };

export default function GuidesPage() {
  const [data, setData] = useState<GuidesData>({ links: [], hidden: [] });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Until the first load finishes (or fails), show a skeleton instead of empty states.
  const [loaded, setLoaded] = useState(false);
  const offerUndo = useUndo();

  const load = useCallback(() => {
    api<GuidesData>("/guides")
      .then((result) => {
        setData(result);
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

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      return true;
    } catch (e) {
      setError(describeError(e));
      return false;
    } finally {
      load();
    }
  }

  const hidden = new Set(data.hidden);
  const guides: Guide[] = [...BUILT_IN_GUIDES.filter((g) => !hidden.has(g.id)), ...data.links.map(fromLink)];
  const categories = categoriesOf(guides);
  const shown = filterGuides(guides, query, category);
  const shownCategories = categoriesOf(shown);

  function hide(guide: Guide) {
    run(async () => {
      await send("PUT", `/guides/hidden/${guide.id}`);
      offerUndo(`${guide.title} hidden`, async () => {
        await send("DELETE", `/guides/hidden/${guide.id}`);
        load();
      });
    });
  }

  function remove(link: GuideLink) {
    run(async () => {
      await send("DELETE", `/guides/links/${link.id}`);
      offerUndo(`${link.title} deleted`, async () => {
        await send("POST", "/guides/links", { title: link.title, url: link.url, description: link.description, category: link.category });
        load();
      });
    });
  }

  const linkOf = (guide: Guide) => data.links.find((l) => l.id === guide.linkId);

  // Sections appear after loading, so a link like /guides/#honing-and-gear scrolls once they're there.
  useEffect(() => {
    if (loaded && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [loaded]);

  if (!loaded) return <PageSkeleton title="Guides" />;

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
          <GameIcon name="guides" size={32} alt="" /> Guides
        </h1>
        <p className="text-sm text-muted">
          Hand-picked guides, tools and databases from around the community, plus your own links. They open in your
          browser; the tracker doesn&apos;t load anything from them. Built-in links last checked {GUIDES_CHECKED}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-56 flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-2.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides (honing, gold, astrogems...)"
            aria-label="Search guides"
            className="w-full pl-8"
          />
        </label>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
        >
          <Plus size={14} /> Add a link
        </button>
        {hidden.size > 0 && (
          <button
            onClick={() => run(() => send("DELETE", "/guides/hidden"))}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            <RotateCcw size={14} /> Reset hidden ({hidden.size})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categories">
        {[null, ...categories].map((c) => (
          <button
            key={c ?? "all"}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`rounded-full border px-3 py-1 text-sm ${
              category === c ? "border-accent bg-accent/15 font-medium" : "border-border text-muted hover:bg-surface-2"
            }`}
          >
            {c ?? "All"}
          </button>
        ))}
      </div>

      {adding && (
        <GuideLinkForm
          categories={categories}
          onSave={(draft: GuideLinkDraft) => run(() => send("POST", "/guides/links", draft))}
          onCancel={() => setAdding(false)}
        />
      )}

      {shown.length === 0 && <p className="text-sm text-muted">No links match. Try another word, or add your own.</p>}

      {shownCategories.map((c) => (
        <section key={c} id={categorySlug(c)} className="scroll-mt-4">
          <h2 className="mb-2 font-semibold">{c}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown
              .filter((g) => g.category === c)
              .map((guide) => {
                const link = linkOf(guide);
                if (link && editing === link.id) {
                  return (
                    <div key={guide.id} className="sm:col-span-2 lg:col-span-3">
                      <GuideLinkForm
                        link={link}
                        categories={categories}
                        onSave={async (draft) => {
                          const ok = await run(() => send("PATCH", `/guides/links/${link.id}`, draft));
                          if (ok) setEditing(null);
                          return ok;
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  );
                }
                return (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    onHide={link ? undefined : () => hide(guide)}
                    onEdit={link ? () => setEditing(link.id) : undefined}
                    onDelete={link ? () => remove(link) : undefined}
                  />
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
