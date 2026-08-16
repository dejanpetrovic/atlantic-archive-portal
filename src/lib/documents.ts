import "server-only";
import type { Row, RowList } from "postgres";
import { db } from "./db";
import type { Vault } from "./authz";
import type { DocRow, DocSearchResponse, FacetCount } from "./types";

// ts_headline emits these tokens; we escape the text and then swap them for
// <mark> so no database content is ever interpreted as HTML.
const HL_START = "[[[H]]]";
const HL_STOP = "[[[/H]]]";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function snippetToHtml(raw: string | null): string | null {
  if (raw == null) return null;
  return escapeHtml(raw)
    .replaceAll(HL_START, "<mark>")
    .replaceAll(HL_STOP, "</mark>");
}

// Keyset cursor over (document_date desc nulls-as-epoch, id desc).
const DATE_FLOOR = "0001-01-01";

export function encodeCursor(d: string | null, i: string): string {
  return Buffer.from(JSON.stringify({ d, i })).toString("base64url");
}

export function decodeCursor(
  cursor: string | null,
): { d: string; i: string } | null {
  if (!cursor) return null;
  try {
    const { d, i } = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { d: string | null; i: string };
    if (typeof i !== "string" || !/^\d+$/.test(i)) return null;
    const date = d ?? DATE_FLOOR;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    return { d: date, i };
  } catch {
    return null;
  }
}

export type DocSearchParams = {
  vault: Vault; // one of the two document vaults
  q: string;
  retailer: string | null;
  docType: string | null;
  poNumber: string | null;
  dateFrom: string | null; // yyyy-mm-dd
  dateTo: string | null;
  cursor: string | null;
  pageSize?: number;
};

type Fragment = ReturnType<ReturnType<typeof db>>;

export async function searchDocuments(
  p: DocSearchParams,
): Promise<DocSearchResponse> {
  const sql = db();
  const pageSize = Math.min(p.pageSize ?? 50, 50);
  const q = p.q.trim();

  const conds = (opts: { retailer?: boolean; docType?: boolean }) => {
    const list = [sql`bucket = ${p.vault}`];
    if (q)
      list.push(
        sql`content_fts @@ websearch_to_tsquery('english', ${q})`,
      );
    if (p.retailer && opts.retailer !== false)
      list.push(sql`retailer = ${p.retailer}`);
    if (p.docType && opts.docType !== false)
      list.push(sql`doc_type = ${p.docType}`);
    // po_number can be a comma-separated list on multi-PO documents.
    if (p.poNumber)
      list.push(sql`${p.poNumber} = any(string_to_array(po_number, ','))`);
    if (p.dateFrom) list.push(sql`document_date >= ${p.dateFrom}::date`);
    if (p.dateTo) list.push(sql`document_date <= ${p.dateTo}::date`);
    return list.reduce((a, b) => sql`${a} and ${b}`);
  };

  const cur = decodeCursor(p.cursor);
  const cursorCond = cur
    ? sql`and (coalesce(document_date, ${DATE_FLOOR}::date), id) < (${cur.d}::date, ${cur.i}::bigint)`
    : sql``;

  const headlineOpts = `StartSel="${HL_START}", StopSel="${HL_STOP}", MaxWords=32, MinWords=12, MaxFragments=2, FragmentDelimiter=" … "`;
  const snippetExpr = q
    ? sql`ts_headline('english', content_text, websearch_to_tsquery('english', ${q}), ${headlineOpts})`
    : sql`null`;

  const [rows, totalRows, retailerFacet, docTypeFacet] = await Promise.all([
    sql`
      select id::text as id, retailer, doc_type, po_number,
             document_date::text as document_date, object_key, size_bytes,
             (content_text is not null) as searchable,
             ${snippetExpr} as snippet
      from file_vault.stored_files
      where ${conds({})} ${cursorCond}
      order by coalesce(document_date, ${DATE_FLOOR}::date) desc, id desc
      limit ${pageSize}
    ` as unknown as Promise<RowList<Row[]>>,
    sql`
      select count(*)::int as total
      from file_vault.stored_files
      where ${conds({})}
    ` as unknown as Promise<{ total: number }[]>,
    sql`
      select retailer as value, count(*)::int as count
      from file_vault.stored_files
      where ${conds({ retailer: false })} and retailer is not null
      group by 1 order by 2 desc, 1
    ` as unknown as Promise<FacetCount[]>,
    sql`
      select doc_type as value, count(*)::int as count
      from file_vault.stored_files
      where ${conds({ docType: false })} and doc_type is not null
      group by 1 order by 2 desc, 1
    ` as unknown as Promise<FacetCount[]>,
  ]);

  const docRows: DocRow[] = rows.map((r) => ({
    id: r.id as string,
    retailer: r.retailer as string | null,
    doc_type: r.doc_type as string | null,
    po_number: r.po_number as string | null,
    document_date: r.document_date as string | null,
    object_key: r.object_key as string,
    size_bytes: r.size_bytes == null ? null : Number(r.size_bytes),
    snippet: snippetToHtml(r.snippet as string | null),
    searchable: Boolean(r.searchable),
  }));

  const last = docRows[docRows.length - 1];
  return {
    rows: docRows,
    facets: { retailer: retailerFacet, doc_type: docTypeFacet },
    total: totalRows[0]?.total ?? 0,
    nextCursor:
      docRows.length === pageSize && last
        ? encodeCursor(last.document_date, last.id)
        : null,
  };
}

export type StoredFile = {
  id: string;
  bucket: Vault;
  object_key: string;
  retailer: string | null;
  doc_type: string | null;
  po_number: string | null;
  document_date: string | null;
  uploaded_at: string | null;
  size_bytes: number | null;
  content_type: string | null;
  content_text: string | null;
};

export async function getStoredFile(
  id: string,
  withContent = false,
): Promise<StoredFile | null> {
  if (!/^\d+$/.test(id)) return null;
  const sql = db();
  const contentExpr: Fragment = withContent
    ? sql`content_text`
    : sql`null as content_text`;
  const rows = await sql`
    select id::text as id, bucket, object_key, retailer, doc_type, po_number,
           document_date::text as document_date, uploaded_at::text as uploaded_at,
           size_bytes, content_type, ${contentExpr}
    from file_vault.stored_files
    where id = ${id}::bigint
    limit 1
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ...r,
    size_bytes: r.size_bytes == null ? null : Number(r.size_bytes),
  } as StoredFile;
}
