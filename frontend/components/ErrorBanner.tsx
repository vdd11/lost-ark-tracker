import { X } from "lucide-react";

export default function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss?: () => void }) {
  if (!error) return null;

  return (
    <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      <span>{error}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded px-1 hover:bg-danger/10">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function describeError(error: unknown) {
  // fetch() rejects with a TypeError when the server can't be reached at all.
  if (error instanceof TypeError) {
    return "Can't reach the tracker. If you're using the app, check that its window is still open.";
  }
  return error instanceof Error ? error.message : String(error);
}
