import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

/** One tracker section: an icon, a title, when it resets, and how far along you are. */
export default function TrackerCard({
  icon: Icon,
  title,
  subtitle,
  done,
  total,
  extra,
  children,
}: {
  icon: LucideIcon;
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
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Icon size={18} />
          </span>
          <div>
            <h2 className="font-semibold leading-tight">{title}</h2>
            <p className="text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {extra}
          {showProgress && (
            <div className="flex items-center gap-2" title={`${done} of ${total} done`}>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-2">
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
