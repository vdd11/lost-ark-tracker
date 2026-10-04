"use client";

import { ChevronRight, Gem, Hammer, Tags, Wrench } from "lucide-react";
import Link from "next/link";

import { Tool, TOOLS } from "@/lib/tools";

const ICONS: Record<Tool["icon"], typeof Tags> = { prices: Tags, honing: Hammer, astrogems: Gem };

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
          <Wrench size={22} /> Tools
        </h1>
        <p className="text-sm text-muted">
          Planners that use what the tracker already knows: your characters, your gold and your weekly income. Everything
          runs on this computer; numbers you enter stay here.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = ICONS[tool.icon];
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col gap-2 rounded-md border border-border bg-surface p-4 hover:border-accent/60"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon size={18} className="text-accent" /> {tool.title}
                <ChevronRight size={16} className="ml-auto text-muted group-hover:text-accent" />
              </span>
              <span className="text-sm text-muted">{tool.description}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
