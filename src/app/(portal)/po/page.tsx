"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PoLookupPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const go = () => {
    const po = value.trim();
    if (po) router.push(`/po/${encodeURIComponent(po)}`);
  };

  return (
    <div className="mx-auto max-w-lg py-20">
      <h1 className="text-lg font-semibold tracking-tight">PO lookup</h1>
      <p className="mt-1 text-ink-dim">
        Lifecycle timeline and every archived document for a purchase order.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="mt-5 flex gap-2"
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="PO number"
          autoFocus
          spellCheck={false}
          className="flex-1 rounded-md border border-edge bg-surface-1 px-3 py-2 font-mono outline-none transition-colors focus:border-accent-dim focus:bg-surface-2"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 font-medium text-surface-0 transition-opacity hover:opacity-90"
        >
          Look up
        </button>
      </form>
    </div>
  );
}
