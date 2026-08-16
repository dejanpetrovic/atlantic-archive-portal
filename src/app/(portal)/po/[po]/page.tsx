import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { atLeast, queryEffectiveLevels, requireUser, type Vault } from "@/lib/authz";
import { getPoDocuments, getPoLifecycle, type PoLifecycle } from "@/lib/po";
import { logAccess } from "@/lib/log";
import { formatBytes } from "@/lib/xml";

export const metadata: Metadata = { title: "PO lookup" };

const STAGES = [
  { key: "ordered_at", label: "Ordered" },
  { key: "acked_at", label: "Acknowledged" },
  { key: "shipped_at", label: "Shipped" },
  { key: "invoiced_at", label: "Invoiced" },
] as const;

export default async function PoPage({
  params,
}: {
  params: Promise<{ po: string }>;
}) {
  const { po: rawPo } = await params;
  const po = decodeURIComponent(rawPo);
  const user = await requireUser();

  const levels = await queryEffectiveLevels(user.id);
  const visibleVaults = (
    ["acid-retailer-docs", "acid-order-docs"] as Vault[]
  ).filter((v) => atLeast(levels[v], "search"));
  if (!visibleVaults.length) redirect("/");

  const [lifecycle, documents] = await Promise.all([
    getPoLifecycle(po),
    getPoDocuments(po, visibleVaults),
  ]);
  await logAccess(user.id, "search", undefined, undefined, JSON.stringify({ po }));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3">
        <Link href="/po" className="text-xs text-link hover:underline">
          ← PO lookup
        </Link>
        <h1 className="font-mono text-lg font-semibold tracking-tight">
          PO {po}
        </h1>
      </div>

      {lifecycle.length === 0 && documents.length === 0 && (
        <div className="rounded-lg border border-edge bg-surface-1 py-16 text-center text-ink-faint">
          Nothing in the archive for this PO.
        </div>
      )}

      {lifecycle.map((row) => (
        <Timeline key={`${row.retailer}-${row.po_number}`} row={row} />
      ))}

      {documents.length > 0 && (
        <section>
          <h2 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">
            Documents · {documents.length}
          </h2>
          <div className="space-y-px">
            {documents.map((d) => {
              const siblings = (d.po_number ?? "")
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s && s !== po);
              return (
                <Link
                  key={d.id}
                  href={
                    d.bucket === "acid-retailer-docs"
                      ? `/documents/${d.id}`
                      : `/order-docs/${d.id}`
                  }
                  className="flex items-center gap-2 rounded px-3 py-2 text-xs transition-colors hover:bg-surface-1"
                >
                  <span className="text-ink-dim">
                    {d.document_date ?? d.uploaded_at?.slice(0, 10) ?? "no date"}
                  </span>
                  {d.retailer && (
                    <span className="text-accent">{d.retailer}</span>
                  )}
                  {d.doc_type && (
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-ink-dim">
                      {d.doc_type}
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      d.bucket === "acid-retailer-docs"
                        ? "bg-link/15 text-link"
                        : "bg-warn/15 text-warn"
                    }`}
                  >
                    {d.bucket === "acid-retailer-docs" ? "EDI" : "order doc"}
                  </span>
                  {siblings.length > 0 && (
                    <span
                      className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-xs text-accent"
                      title={`This document also covers PO ${siblings.join(", ")}`}
                    >
                      +{siblings.length} PO{siblings.length > 1 ? "s" : ""}:{" "}
                      {siblings.join(", ")}
                    </span>
                  )}
                  <span className="ml-auto truncate pl-4 font-mono text-xs text-ink-faint">
                    {d.object_key.split("/").pop()}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatBytes(d.size_bytes)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Timeline({ row }: { row: PoLifecycle }) {
  return (
    <section className="rounded-lg border border-edge bg-surface-1 p-4">
      {row.retailer && (
        <div className="mb-3 font-mono text-xs text-accent">{row.retailer}</div>
      )}
      <ol className="flex flex-wrap items-start gap-0">
        {STAGES.map((stage, i) => {
          const at = row[stage.key];
          const done = at != null;
          return (
            <li key={stage.key} className="flex items-start">
              {i > 0 && (
                <div
                  className={`mx-2 mt-[7px] h-px w-8 sm:w-14 ${
                    done ? "bg-ok/60" : "bg-edge-strong"
                  }`}
                />
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block size-[9px] rounded-full ${
                      done ? "bg-ok" : "border border-edge-strong"
                    }`}
                  />
                  <span
                    className={`text-xs ${done ? "text-ink" : "text-ink-faint"}`}
                  >
                    {stage.label}
                  </span>
                </div>
                <div className="mt-0.5 pl-[15px] font-mono text-[11px] text-ink-dim">
                  {done ? formatTs(at) : "pending"}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatTs(ts: string): string {
  // timestamps come back as text; show date + hh:mm when present
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : ts.slice(0, 10);
}
