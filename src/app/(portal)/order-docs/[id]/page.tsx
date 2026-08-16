import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { atLeast, requireLevelOrHome, requireUser } from "@/lib/authz";
import { getStoredFile } from "@/lib/documents";
import { formatBytes } from "@/lib/xml";
import {
  PREVIEW_MAX_BYTES,
  PREVIEW_MAX_ROWS,
  fetchSheetPreview,
  fileExtension,
  previewKind,
} from "@/lib/preview";
import { SheetTable } from "@/components/sheet-table";
import { logAccess } from "@/lib/log";

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
  const kind = previewKind(file.object_key, file.content_type);

  // CSV/XLSX are parsed server-side (bounded 5 MB exception to the no-proxy
  // rule); images and PDFs stream direct from B2 via the inline route, which
  // does its own view logging.
  let sheets = null;
  if (canDownload && kind === "sheet") {
    sheets = await fetchSheetPreview(
      file.bucket,
      file.object_key,
      file.size_bytes,
    );
    if (sheets) {
      await logAccess(user.id, "view", file.bucket, file.object_key);
    }
  }

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
          <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-dim">
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
        <span className="font-mono text-xs text-ink-faint">
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
        className="truncate font-mono text-xs text-ink-faint"
        title={file.object_key}
      >
        {file.object_key}
      </p>

      {!canDownload ? (
        <div className="rounded-lg border border-edge bg-surface-1 py-16 text-center text-ink-faint">
          Your access level allows metadata only. Ask your admin for download
          access to view files.
        </div>
      ) : kind === "pdf" ? (
        // The iframe hits the inline route, which re-checks authorization,
        // logs the view and 302s to a signed B2 URL — bytes never touch us.
        <iframe
          src={`/api/files/${file.id}/inline`}
          title={file.object_key}
          className="min-h-0 w-full flex-1 rounded-lg border border-edge bg-surface-1"
        />
      ) : kind === "image" ? (
        // Same mechanism as audio/PDF: the <img> fetches the inline route,
        // which logs the view and redirects to a signed B2 URL.
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-edge bg-surface-1 p-4">
          <a
            href={`/api/files/${file.id}/inline`}
            target="_blank"
            rel="noreferrer"
            title="Open full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${file.id}/inline`}
              alt={file.object_key}
              className="max-h-full max-w-full rounded"
            />
          </a>
        </div>
      ) : kind === "sheet" && sheets ? (
        <SheetTable sheets={sheets} maxRows={PREVIEW_MAX_ROWS} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-edge bg-surface-1 py-16 text-center">
          <FileIcon label={fileExtension(file.object_key)} />
          <p className="text-xs text-ink-faint">
            {kind === "sheet"
              ? `File exceeds the ${Math.round(PREVIEW_MAX_BYTES / 1024 / 1024)} MB preview cap — use Download.`
              : "No inline preview for this file type — use Download."}
          </p>
        </div>
      )}
    </div>
  );
}

function FileIcon({ label }: { label: string }) {
  return (
    <div className="relative">
      <svg width="44" height="56" viewBox="0 0 44 56" fill="none" aria-hidden>
        <path
          d="M4 4a4 4 0 0 1 4-4h20l12 12v36a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4z"
          className="fill-surface-3"
        />
        <path d="M28 0l12 12H30a2 2 0 0 1-2-2V0z" className="fill-edge-strong" />
      </svg>
      <span className="absolute inset-x-0 bottom-3 text-center font-mono text-[11px] font-semibold text-ink-dim">
        {label}
      </span>
    </div>
  );
}
