"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocRow, DocSearchResponse } from "@/lib/types";

export type PaletteSurfaces = {
  documents: boolean;
  po: boolean;
  orderDocs: boolean;
  recordings: boolean;
  admin: boolean;
};

type Command = {
  key: string;
  kind: "nav" | "po" | "phone" | "doc" | "search";
  label: string;
  hint?: string;
  snippet?: string | null;
  href: string;
};

const PHONE_RE = /^[\d\s()+.\-]+$/;
const PO_RE = /^[A-Za-z0-9_-]{4,24}$/;

export function CommandPalette({ surfaces }: { surfaces: PaletteSurfaces }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ⌘K / Ctrl+K toggles (with a clean slate); Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQ("");
        setDocs([]);
        setSelected(0);
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live document search for free text.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      if (!surfaces.documents || !q.trim()) {
        setDocs([]);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const params = new URLSearchParams({
          vault: "acid-retailer-docs",
          q: q.trim(),
        });
        const res = await fetch(`/api/documents/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as DocSearchResponse;
        setDocs(json.rows.slice(0, 8));
        setSelected(0);
      } catch {
        /* aborted or offline — palette stays usable */
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q, open, surfaces.documents]);

  const commands = buildCommands(q, surfaces, docs);

  const run = useCallback(
    (cmd: Command) => {
      setOpen(false);
      router.push(cmd.href);
    },
    [router],
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && commands[selected]) {
      e.preventDefault();
      run(commands[selected]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="mx-auto mt-[12vh] w-full max-w-xl overflow-hidden rounded-xl border border-edge-strong bg-surface-1 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="Search documents, jump to a PO or phone number…"
          spellCheck={false}
          className="w-full border-b border-edge bg-transparent px-4 py-3 outline-none placeholder:text-ink-faint"
        />
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {commands.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-ink-faint">
              {q ? "No matches." : "Type to search across the archive."}
            </p>
          )}
          {commands.map((cmd, i) => (
            <button
              key={cmd.key}
              onClick={() => run(cmd)}
              onMouseMove={() => setSelected(i)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                i === selected ? "bg-surface-3" : ""
              }`}
            >
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] tracking-wider uppercase ${kindTone(cmd.kind)}`}
              >
                {cmd.kind}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-ink">{cmd.label}</span>
                {cmd.snippet && (
                  <span
                    className="block truncate text-xs text-ink-dim"
                    dangerouslySetInnerHTML={{ __html: cmd.snippet }}
                  />
                )}
              </span>
              {cmd.hint && (
                <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-faint">
                  {cmd.hint}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-3 border-t border-edge px-4 py-2 font-mono text-[11px] text-ink-faint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

function kindTone(kind: Command["kind"]): string {
  switch (kind) {
    case "doc":
      return "bg-link/15 text-link";
    case "po":
      return "bg-accent/15 text-accent";
    case "phone":
      return "bg-ok/15 text-ok";
    default:
      return "bg-surface-3 text-ink-dim";
  }
}

function buildCommands(
  q: string,
  surfaces: PaletteSurfaces,
  docs: DocRow[],
): Command[] {
  const out: Command[] = [];
  const trimmed = q.trim();
  const digits = trimmed.replace(/\D/g, "");

  // Phone-number pattern → recordings (when permitted).
  if (
    surfaces.recordings &&
    trimmed &&
    PHONE_RE.test(trimmed) &&
    digits.length >= 7
  ) {
    out.push({
      key: "phone",
      kind: "phone",
      label: `Search recordings for …${digits.slice(-10)}`,
      href: `/recordings?phone=${encodeURIComponent(digits)}`,
    });
  }

  // PO pattern → PO lookup.
  if (surfaces.po && trimmed && PO_RE.test(trimmed)) {
    out.push({
      key: "po",
      kind: "po",
      label: `Open PO ${trimmed}`,
      href: `/po/${encodeURIComponent(trimmed)}`,
    });
  }

  // Free-text search shortcut + live results.
  if (surfaces.documents && trimmed) {
    out.push({
      key: "search-docs",
      kind: "search",
      label: `Search documents for “${trimmed}”`,
      href: `/documents?q=${encodeURIComponent(trimmed)}`,
    });
  }
  for (const d of docs) {
    out.push({
      key: `doc-${d.id}`,
      kind: "doc",
      label: [d.document_date, d.retailer, d.doc_type, d.po_number && `PO ${d.po_number}`]
        .filter(Boolean)
        .join(" · "),
      snippet: d.snippet,
      href: `/documents/${d.id}?q=${encodeURIComponent(trimmed)}`,
    });
  }

  // Navigation for empty/short input.
  const navs: [keyof PaletteSurfaces, string, string][] = [
    ["documents", "Documents", "/documents"],
    ["po", "PO lookup", "/po"],
    ["orderDocs", "Order docs", "/order-docs"],
    ["recordings", "Recordings", "/recordings"],
    ["admin", "Admin", "/admin"],
  ];
  for (const [key, label, href] of navs) {
    if (!surfaces[key]) continue;
    if (!trimmed || label.toLowerCase().includes(trimmed.toLowerCase())) {
      out.push({ key: `nav-${href}`, kind: "nav", label, href, hint: "go to" });
    }
  }

  return out;
}
