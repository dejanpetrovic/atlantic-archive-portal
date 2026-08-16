import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { atLeast, requireLevelOrHome, requireUser } from "@/lib/authz";
import { getStoredFile } from "@/lib/documents";
import { formatBytes } from "@/lib/xml";

export const metadata: Metadata = { title: "Order doc" };

export default async function OrderDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ id }, { q }] = await Promise.all([params, searchParams]);
  const user = await requireUser();

  const file = await getStoredFile(id);
  if (!file || file.bucket !== "acid-order-docs") notFound();

  const level = await requireLevelOrHome(user.id, "acid-order-docs", "search");
  const canDownload = atLeast(level, "download");
  const isPdf =
    file.content_type?.includes("pdf") ||
    file.object_key.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/order-docs${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className="text-xs text-link hover:underline"
        >
          ← Order docs
        </Link>
        <span className="font-mono text-xs text-ink-dim">
          {file.document_date ?? file.uploaded_at?.slice(0, 10) ?? "no date"}
        </span>
        {file.doc_type && (
          <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
            {file.doc_type}
          </span>
        )}
        {file.po_number && (
          <Link
            href={`/po/${encodeURIComponent(file.po_number)}`}
            className="font-mono text-xs text-link hover:underline"
          >
            PO {file.po_number}
          </Link>
        )}
        <span className="font-mono text-[11px] text-ink-faint">
          {formatBytes(file.size_bytes)}
        </span>
        <div className="ml-auto">
          {canDownload && (
            <a
              href={`/api/files/${file.id}/download`}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-90"
            >
              Download
            </a>
          )}
        </div>
      </div>

      <p
        className="truncate font-mono text-[11px] text-ink-faint"
        title={file.object_key}
      >
        {file.object_key}
      </p>

      {canDownload && isPdf ? (
        // The iframe hits the inline route, which re-checks authorization,
        // logs the view and 302s to a signed B2 URL — bytes never touch us.
        <iframe
          src={`/api/files/${file.id}/inline`}
          title={file.object_key}
          className="min-h-0 w-full flex-1 rounded-lg border border-edge bg-surface-1"
        />
      ) : (
        <div className="rounded-lg border border-edge bg-surface-1 py-16 text-center text-ink-faint">
          {canDownload
            ? "Preview not available for this file type — use Download."
            : "Your access level allows metadata only. Ask your admin for download access to view files."}
        </div>
      )}
    </div>
  );
}
