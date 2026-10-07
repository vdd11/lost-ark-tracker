"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import GameIcon from "@/components/GameIcon";
import WhatsNewDialog from "@/components/WhatsNew";
import { api } from "@/lib/api";
import { releasePage } from "@/lib/updates";
import { WHATS_NEW } from "@/lib/whatsNew";

/** The version running, and every release's notes (bundled with the app). */
export default function AboutSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api<{ version: string }>("/")
      .then((info) => setVersion(info.version))
      .catch(() => {});
  }, []);

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <GameIcon name="whats-new" size={32} framed alt="" /> About
      </h2>
      <p className="mb-3 text-sm text-muted">
        Lost Ark Tracker <span className="font-medium text-foreground">{version ? `v${version}` : "…"}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button onClick={() => setOpen(true)} className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">
          What&apos;s new
        </button>
        {version && (
          <a href={releasePage(version)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted underline hover:text-foreground">
            This version on GitHub <ExternalLink size={12} />
          </a>
        )}
      </div>
      {open && <WhatsNewDialog entries={WHATS_NEW} onClose={() => setOpen(false)} />}
    </section>
  );
}
