/** A grey placeholder block; it pulses unless the system asks for reduced motion. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-md bg-surface-2 motion-safe:animate-pulse ${className}`} />;
}

/**
 * What a page shows while its data loads: its title and the rough shape of
 * its content, so nothing jumps when the real thing arrives.
 */
export function PageSkeleton({ title, blocks = 3 }: { title: string; blocks?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label={`Loading ${title}`}>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      {Array.from({ length: blocks }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? "h-56" : "h-32"} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
