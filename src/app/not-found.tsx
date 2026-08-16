import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      <p className="font-mono text-xs tracking-widest text-ink-faint">404</p>
      <h1 className="mt-2 text-lg font-medium">Not in the archive</h1>
      <Link href="/" className="mt-3 text-xs text-link hover:underline">
        ← Back to the portal
      </Link>
    </div>
  );
}
