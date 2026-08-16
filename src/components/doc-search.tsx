"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { DocRow, DocSearchResponse, FacetCount } from "@/lib/types";
import { formatBytes } from "@/lib/xml";

type Props = {
  vault: "acid-retailer-docs" | "acid-order-docs";
  canDownload: boolean;
  /** Detail page prefix, e.g. "/documents" — row click goes to `${prefix}/${id}`. */
  detailPath: string;
  placeholder: string;
  showPoFilter?: boolean;
  showSearchableBadge?: boolean;
};

export function DocSearch({
  vault,
  detailPath,
  placeholder,
  showPoFilter = false,
  showSearchableBadge = false,
}: Props) {
  const router = useRouter();
  const initial = useSearchParams();

  const [q, setQ] = useState(initial.get("q") ?? "");
  const [retailer, setRetailer] = useState(initial.get("retailer") ?? "");
  const [docType, setDocType] = useState(initial.get("doc_type") ?? "");
  const [po, setPo] = useState(initial.get("po") ?? "");
  const [from, setFrom] = useState(initial.get("from") ?? "");
  const [to, setTo] = useState(initial.get("to") ?? "");

  const [data, setData] = useState<DocSearchResponse | null>(null);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const buildParams = useCallback(
    (cursor?: string) => {
      const p = new URLSearchParams({ vault });
      if (q.trim()) p.set("q", q.trim());
      if (retailer) p.set("retailer", retailer);
      if (docType) p.set("doc_type", docType);
      if (po.trim()) p.set("po", po.trim());
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (cursor) p.set("cursor", cursor);
      return p;
    },
    [vault, q, retailer, docType, po, from, to],
  );

  // Debounced instant search; abort superseded requests.
  useEffect(() => {
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/documents/search?${buildParams()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DocSearchResponse;
        setData(json);
        setRows(json.rows);
        setSelected(0);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Search failed — try again.");
          setLoading(false);
        }
      }
      // Keep the URL shareable without a server round-trip.
      const qs = buildParams();
      qs.delete("vault");
      const url = qs.size
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      window.history.replaceState(null, "", url);
    }, 250);
    return () => clearTimeout(timer);
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    if (!data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/documents/search?${buildParams(data.nextCursor)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DocSearchResponse;
      setRows((prev) => [...prev, ...json.rows]);
      setData((prev) =>
        prev ? { ...prev, nextCursor: json.nextCursor } : json,
      );
    } catch {
      setError("Could not load more results.");
    } finally {
      setLoadingMore(false);
    }
  }, [data, buildParams, loadingMore]);

  const openRow = useCallback(
    (row: DocRow) => {
      const suffix = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      router.push(`${detailPath}/${row.id}${suffix}`);
    },
    [router, detailPath, q],
  );

  // Keyboard: "/" focuses search, arrows move selection, Enter opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (e.key === "/" && !inField) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (inField && e.target !== inputRef.current) return;
        e.preventDefault();
        setSelected((s) => {
          const next =
            e.key === "ArrowDown"
              ? Math.min(s + 1, rows.length - 1)
              : Math.max(s - 1, 0);
          listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
        if (e.target === inputRef.current) inputRef.current?.blur();
      }
      if (e.key === "Enter" && !inField && rows[selected]) {
        openRow(rows[selected]);
      }
      if (e.key === "Enter" && e.target === inputRef.current && rows[selected]) {
        openRow(rows[selected]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selected, openRow]);

  const clearFilters = () => {
    setRetailer("");
    setDocType("");
    setPo("");
    setFrom("");
    setTo("");
  };
  const hasFilters = retailer || docType || po || from || to;

  return (
    <div className="flex gap-5">
      <aside className="w-52 shrink-0 space-y-5">
        <Facet
          title="Retailer"
          items={data?.facets.retailer ?? []}
          active={retailer}
          onToggle={(v) => setRetailer(retailer === v ? "" : v)}
        />
        <Facet
          title="Doc type"
          items={data?.facets.doc_type ?? []}
          active={docType}
          onToggle={(v) => setDocType(docType === v ? "" : v)}
        />
        {showPoFilter && (
          <div>
            <FacetTitle>PO number</FacetTitle>
            <input
              value={po}
              onChange={(e) => setPo(e.target.value)}
              placeholder="Exact PO"
              className="w-full rounded border border-edge bg-surface-1 px-2 py-1 font-mono text-xs outline-none focus:border-accent-dim"
            />
          </div>
        )}
        <div>
          <FacetTitle>Date range</FacetTitle>
          <div className="space-y-1.5">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded border border-edge bg-surface-1 px-2 py-1 text-xs outline-none focus:border-accent-dim"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border border-edge bg-surface-1 px-2 py-1 text-xs outline-none focus:border-accent-dim"
            />
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-link hover:underline"
          >
            Clear filters
          </button>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              autoFocus
              spellCheck={false}
              className="w-full rounded-md border border-edge bg-surface-1 px-3 py-2 outline-none transition-colors focus:border-accent-dim focus:bg-surface-2"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-edge bg-surface-2 px-1.5 font-mono text-[11px] text-ink-faint">
              /
            </kbd>
          </div>
          <span className="shrink-0 font-mono text-xs text-ink-dim">
            {loading ? "…" : `${(data?.total ?? 0).toLocaleString()} docs`}
          </span>
        </div>

        {error && (
          <p className="mt-3 rounded border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">
            {error}
          </p>
        )}

        <div ref={listRef} className="mt-3 space-y-px">
          {loading &&
            rows.length === 0 &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded bg-surface-1"
              />
            ))}
          {!loading && rows.length === 0 && !error && (
            <div className="py-16 text-center text-ink-faint">
              No documents match.
            </div>
          )}
          {rows.map((row, i) => (
            <ResultRow
              key={row.id}
              row={row}
              selected={i === selected}
              onClick={() => openRow(row)}
              onHover={() => setSelected(i)}
              showSearchableBadge={showSearchableBadge}
            />
          ))}
        </div>

        {data?.nextCursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-3 w-full rounded border border-edge bg-surface-1 py-2 text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}

function FacetTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 font-mono text-[11px] tracking-widest text-ink-faint uppercase">
      {children}
    </h3>
  );
}

function Facet({
  title,
  items,
  active,
  onToggle,
}: {
  title: string;
  items: FacetCount[];
  active: string;
  onToggle: (v: string) => void;
}) {
  if (!items.length && !active) return null;
  return (
    <div>
      <FacetTitle>{title}</FacetTitle>
      <ul className="space-y-px">
        {items.map((item) => (
          <li key={item.value}>
            <button
              onClick={() => onToggle(item.value)}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-colors ${
                active === item.value
                  ? "bg-surface-3 text-accent"
                  : "text-ink-dim hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span className="truncate">{item.value}</span>
              <span className="ml-2 font-mono text-[11px] text-ink-faint">
                {item.count.toLocaleString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultRow({
  row,
  selected,
  onClick,
  onHover,
  showSearchableBadge,
}: {
  row: DocRow;
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  showSearchableBadge: boolean;
}) {
  return (
    <div
      onClick={onClick}
      onMouseMove={onHover}
      className={`cursor-pointer rounded px-3 py-2 transition-colors ${
        selected ? "bg-surface-2 ring-1 ring-edge-strong" : "hover:bg-surface-1"
      }`}
    >
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="text-ink-dim">{row.document_date ?? "no date"}</span>
        {row.retailer && <span className="text-accent">{row.retailer}</span>}
        {row.doc_type && (
          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-dim">
            {row.doc_type}
          </span>
        )}
        {showSearchableBadge && row.searchable && (
          <span className="rounded bg-ok/15 px-1.5 py-0.5 text-[11px] text-ok">
            searchable
          </span>
        )}
        {row.po_number && (
          <Link
            href={`/po/${encodeURIComponent(row.po_number)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-link hover:underline"
          >
            PO {row.po_number}
          </Link>
        )}
        <span className="ml-auto text-[11px] text-ink-faint">
          {formatBytes(row.size_bytes)}
        </span>
      </div>
      {row.snippet ? (
        <p
          className="mt-1 truncate text-xs text-ink-dim"
          dangerouslySetInnerHTML={{ __html: row.snippet }}
        />
      ) : (
        <p className="mt-1 truncate font-mono text-xs text-ink-faint">
          {row.object_key}
        </p>
      )}
    </div>
  );
}
