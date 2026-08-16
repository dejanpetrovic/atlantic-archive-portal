import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { atLeast, requireLevelOrHome, requireUser } from "@/lib/authz";
import { getStoredFile } from "@/lib/documents";
import { logAccess } from "@/lib/log";
import { formatBytes } from "@/lib/xml";
import { XmlView } from "@/components/xml-view";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ id }, { q }] = await Promise.all([params, searchParams]);
  const user = await requireUser();

  const file = await getStoredFile(id, true);
  if (!file || file.bucket !== "acid-retailer-docs") notFound();

  const level = await requireLevelOrHome(user.id, "acid-retailer-docs", "search");
  await logAccess(user.id, "view", file.bucket, file.object_key);

  const canDownload = atLeast(level, "download");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/documents${q ? `?q=${encodeURIComponent(q)}` : ""}`}
          className="text-xs text-link hover:underline"
        >
          ← Documents
        </Link>
        <span className="font-mono text-xs text-ink-dim">
          {file.document_date ?? "no date"}
        </span>
        {file.retailer && (
          <span className="font-mono text-xs text-accent">{file.retailer}</span>
        )}
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

      {file.content_text ? (
        <XmlView xml={file.content_text} query={q ?? ""} />
      ) : (
        <div className="rounded-lg border border-edge bg-surface-1 py-16 text-center text-ink-faint">
          No extracted text for this file.
          {canDownload && " Use Download to fetch the original."}
        </div>
      )}
    </div>
  );
}
