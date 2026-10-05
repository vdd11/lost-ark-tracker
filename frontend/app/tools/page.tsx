"use client";

import { ChevronRight, Gem, Hammer, Tags, Wrench } from "lucide-react";
import Link from "next/link";

import { Tool, TOOLS } from "@/lib/tools";
import GameIcon from "@/components/GameIcon";

const ICONS: Record<Tool["icon"], typeof Tags> = { prices: Tags, astrogems: Gem };

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
          <Wrench size={22} /> Tools
        </h1>
        <p className="text-sm text-muted">
          Helpers to keep open beside the game. Everything runs on this computer; numbers you enter stay here.
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
                {tool.gameIcon ? (
                  <GameIcon name={tool.gameIcon} size={22} fallback={Icon} alt="" className="text-accent" />
                ) : (
                  <Icon size={18} className="text-accent" />
                )}{" "}
                {tool.title}
                <ChevronRight size={16} className="ml-auto text-muted group-hover:text-accent" />
              </span>
              <span className="text-sm text-muted">{tool.description}</span>
            </Link>
          );
        })}
      </div>
      <p className="text-sm text-muted">
        <Hammer size={14} className="mr-1.5 inline align-[-2px]" />
        Looking for honing? Other sites do it best: see{" "}
        <Link href="/guides/#honing-and-gear" className="underline hover:text-foreground">
          Guides → Honing and gear
        </Link>{" "}
        for Honing Forecast, Maxroll&apos;s upgrade calculator and more.
      </p>
    </div>
  );
}
