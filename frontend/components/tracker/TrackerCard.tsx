import { ReactNode } from "react";
import GameIcon from "@/components/GameIcon";

/** One tracker section: an icon, a title, when it resets, and how far along you are. */
export default function TrackerCard({
  icon,
  title,
  subtitle,
  done,
  total,
  extra,
  children,
}: {
  /** An icon name (lib/data/icons.ts): a game icon, or its slot glyph. */
  icon: string;
  title: string;
  subtitle: ReactNode;
  done?: number;
  total?: number;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const showProgress = total !== undefined && total > 0;
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <GameIcon name={icon} size={32} framed alt="" />
          <div>
            <h2 className="font-semibold leading-tight">{title}</h2>
            {/* On a phone a progress card keeps to one row: the resets are in the glance strip. */}
            <p className={`text-xs text-muted ${showProgress ? "hidden sm:block" : ""}`}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {extra}
          {showProgress && (
            <div className="flex items-center gap-2" title={`${done} of ${total} done`}>
              <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-surface-2 sm:block">
                <div
                  className={`h-full rounded-full ${done === total ? "bg-done" : "bg-accent"}`}
                  style={{ width: `${(done! / total!) * 100}%` }}
                />
              </div>
              <span className={`tabular-nums ${done === total ? "font-medium text-done" : "text-muted"}`}>
                {done}/{total} done
              </span>
            </div>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}
