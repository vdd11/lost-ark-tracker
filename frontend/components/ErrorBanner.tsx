export default function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <p className="mb-4 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {error}
    </p>
  );
}

export function describeError(error: unknown) {
  if (error instanceof TypeError) {
    return "Can't reach the API. Is the backend running on port 8000?";
  }
  return error instanceof Error ? error.message : String(error);
}
