import "server-only";
import * as XLSX from "xlsx";
import { getSignedDownloadUrl } from "./b2";

// Deliberate, bounded exception to the no-proxy rule: small text/spreadsheet
// files (≤5 MB) are fetched server-side once for parsing so they can render
// as tables. Large media always streams direct from B2.
export const PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
export const PREVIEW_MAX_ROWS = 1000;

export type PreviewKind = "pdf" | "image" | "sheet" | "none";

export function previewKind(
  objectKey: string,
  contentType: string | null,
): PreviewKind {
  const k = objectKey.toLowerCase();
  if (contentType?.includes("pdf") || k.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp)$/.test(k)) return "image";
  if (/\.(csv|xlsx|xls)$/.test(k)) return "sheet";
  return "none";
}

export function fileExtension(objectKey: string): string {
  const m = objectKey.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

export type SheetPreview = {
  name: string;
  /** First row is the header row. Capped at PREVIEW_MAX_ROWS. */
  rows: string[][];
  totalRows: number;
};

// null = not previewable (over the size cap, fetch failed, or unparseable);
// callers fall back to download-only.
export async function fetchSheetPreview(
  bucket: string,
  objectKey: string,
  sizeBytes: number | null,
): Promise<SheetPreview[] | null> {
  if (sizeBytes == null || sizeBytes > PREVIEW_MAX_BYTES) return null;
  try {
    const url = await getSignedDownloadUrl(bucket, objectKey, {
      validSeconds: 60,
    });
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", dense: true });
    return wb.SheetNames.map((name) => {
      const all = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
        header: 1,
        raw: false,
        defval: "",
      }) as string[][];
      return {
        name,
        rows: all.slice(0, PREVIEW_MAX_ROWS),
        totalRows: all.length,
      };
    });
  } catch {
    return null;
  }
}
