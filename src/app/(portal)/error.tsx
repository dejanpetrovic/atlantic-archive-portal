"use client";

export default function PortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-xs tracking-widest text-bad">ERROR</p>
      <h1 className="mt-2 text-lg font-medium">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-ink-dim">
        The request failed. If this keeps happening, contact your admin.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-surface-3 px-4 py-2 text-xs text-ink transition-colors hover:bg-edge"
      >
        Try again
      </button>
    </div>
  );
}
