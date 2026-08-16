"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RecordingRow, RecordingSearchResponse } from "@/lib/types";
import { formatBytes } from "@/lib/xml";

const ROW_H = 36;
const OVERSCAN = 10;

export function RecordingsSearch({ canPlay }: { canPlay: boolean }) {
  const initial = useSearchParams();
  const [phone, setPhone] = useState(initial.get("phone") ?? "");
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState<RecordingRow | null>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(600);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingMoreRef = useRef(false);

  const buildParams = useCallback(
    (cursor?: string | null) => {
      const p = new URLSearchParams();
      if (phone.trim()) p.set("phone", phone.trim());
      if (direction) p.set("direction", direction);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (cursor) p.set("cursor", cursor);
      return p;
    },
    [phone, direction, from, to],
  );

  useEffect(() => {
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/recordings/search?${buildParams()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RecordingSearchResponse & {
          note?: string;
        };
        setRows(json.rows);
        setTotal(json.total);
        setNextCursor(json.nextCursor);
        setNote(json.note ?? null);
        setSelected(0);
        scrollRef.current?.scrollTo({ top: 0 });
        setLoading(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Search failed — try again.");
          setLoading(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [buildParams]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/recordings/search?${buildParams(nextCursor)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RecordingSearchResponse;
      setRows((prev) => [...prev, ...json.rows]);
      setNextCursor(json.nextCursor);
    } catch {
      setError("Could not load more results.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, buildParams]);

  // Measure viewport; auto-fetch next page when scrolled near the end.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    if (el.scrollTop + el.clientHeight > el.scrollHeight - ROW_H * 20) {
      void loadMore();
    }
  };

  const play = useCallback(
    (row: RecordingRow) => {
      if (!canPlay || !row.stored_file_id) return;
      setPlaying(row);
      // New src per play: the server mints a fresh signed URL and logs it.
      requestAnimationFrame(() => {
        const el = audioRef.current;
        if (el) {
          el.src = `/api/files/${row.stored_file_id}/inline`;
          void el.play().catch(() => {});
        }
      });
    },
    [canPlay],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (inField) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => {
          const next =
            e.key === "ArrowDown"
              ? Math.min(s + 1, rows.length - 1)
              : Math.max(s - 1, 0);
          const el = scrollRef.current;
          if (el) {
            const top = next * ROW_H;
            if (top < el.scrollTop) el.scrollTo({ top });
            else if (top + ROW_H > el.scrollTop + el.clientHeight)
              el.scrollTo({ top: top + ROW_H - el.clientHeight });
          }
          return next;
        });
      }
      if (e.key === "Enter" && rows[selected]) play(rows[selected]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selected, play]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN,
  );

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number (min 7 digits, suffix match)"
          autoFocus
          spellCheck={false}
          className="w-72 rounded-md border border-edge bg-surface-1 px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-accent-dim focus:bg-surface-2"
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="rounded-md border border-edge bg-surface-1 px-2 py-2 text-xs outline-none focus:border-accent-dim"
        >
          <option value="">Any direction</option>
          <option value="incoming">Incoming</option>
          <option value="outgoing">Outgoing</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-edge bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent-dim"
        />
        <span className="text-xs text-ink-faint">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-edge bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent-dim"
        />
        <span className="ml-auto font-mono text-xs text-ink-dim">
          {loading ? "…" : `${total.toLocaleString()} calls`}
        </span>
      </div>

      {note && <p className="text-xs text-warn">{note}</p>}
      {error && (
        <p className="rounded border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 border-b border-edge px-3 pb-1.5 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
        <span className="w-36">Started</span>
        <span className="w-16">Dir</span>
        <span className="w-40">Other party</span>
        <span className="w-12">Ext</span>
        <span className="w-16 text-right">Size</span>
        <span className="ml-auto" />
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {loading && rows.length === 0 && (
          <div className="space-y-px">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-surface-1" />
            ))}
          </div>
        )}
        {!loading && rows.length === 0 && !error && (
          <div className="py-16 text-center text-ink-faint">
            No recordings match.
          </div>
        )}
        <div
          style={{ height: rows.length * ROW_H, position: "relative" }}
        >
          {rows.slice(start, end).map((row, idx) => {
            const i = start + idx;
            return (
              <div
                key={row.id}
                onClick={() => setSelected(i)}
                onDoubleClick={() => play(row)}
                style={{ position: "absolute", top: i * ROW_H, height: ROW_H }}
                className={`flex w-full cursor-default items-center gap-2 rounded px-3 font-mono text-[11px] ${
                  i === selected
                    ? "bg-surface-2 ring-1 ring-edge-strong"
                    : "hover:bg-surface-1"
                } ${playing?.id === row.id ? "text-accent" : ""}`}
              >
                <span className="w-36 truncate text-ink-dim">
                  {row.started_at?.slice(0, 16) ?? "—"}
                </span>
                <span
                  className={`w-16 ${
                    row.direction === "incoming" ? "text-ok" : "text-link"
                  }`}
                >
                  {row.direction ?? "—"}
                </span>
                <span className="w-40 truncate">{row.other_party ?? "—"}</span>
                <span className="w-12 truncate text-ink-dim">
                  {row.extension ?? "—"}
                </span>
                <span className="w-16 text-right text-ink-dim">
                  {formatBytes(row.size_bytes)}
                </span>
                <span className="ml-auto flex gap-1">
                  {canPlay && row.stored_file_id && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          play(row);
                        }}
                        className="rounded px-2 py-0.5 text-[10px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
                      >
                        ▶ play
                      </button>
                      <a
                        href={`/api/files/${row.stored_file_id}/download`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded px-2 py-0.5 text-[10px] text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
                      >
                        ↓
                      </a>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {loadingMore && (
          <div className="py-2 text-center font-mono text-[10px] text-ink-faint">
            loading…
          </div>
        )}
      </div>

      {playing && (
        <div className="flex items-center gap-3 rounded-lg border border-edge bg-surface-1 px-3 py-2">
          <div className="min-w-0 font-mono text-[11px]">
            <div className="truncate text-ink">
              {playing.direction === "incoming"
                ? `${playing.other_party ?? "?"} → ext ${playing.extension ?? "?"}`
                : `ext ${playing.extension ?? "?"} → ${playing.other_party ?? "?"}`}
            </div>
            <div className="text-[10px] text-ink-faint">
              {playing.started_at?.slice(0, 16)} ·{" "}
              {formatBytes(playing.size_bytes)}
            </div>
          </div>
          <audio ref={audioRef} controls className="h-8 flex-1" />
          <button
            onClick={() => {
              audioRef.current?.pause();
              setPlaying(null);
            }}
            className="text-xs text-ink-dim hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
