import "server-only";
import { db } from "./db";
import type { Vault } from "./authz";

export type PoLifecycle = {
  retailer: string | null;
  po_number: string;
  ordered_at: string | null;
  acked_at: string | null;
  shipped_at: string | null;
  invoiced_at: string | null;
};

export type PoDocument = {
  id: string;
  bucket: Vault;
  retailer: string | null;
  doc_type: string | null;
  document_date: string | null;
  uploaded_at: string | null;
  object_key: string;
  size_bytes: number | null;
  /** Raw po_number — may be a comma-separated list for multi-PO documents. */
  po_number: string | null;
};

// One row per retailer+PO — the same PO can exist at several retailers.
export async function getPoLifecycle(po: string): Promise<PoLifecycle[]> {
  const rows = await db()`
    select retailer, po as po_number,
           ordered_at::text as ordered_at, acked_at::text as acked_at,
           shipped_at::text as shipped_at, invoiced_at::text as invoiced_at
    from file_vault.po_lifecycle
    where po = ${po}
    order by retailer
  `;
  return rows as unknown as PoLifecycle[];
}

export async function getPoDocuments(
  po: string,
  vaults: Vault[],
): Promise<PoDocument[]> {
  if (!vaults.length) return [];
  const sql = db();
  const rows = await sql`
    select id::text as id, bucket, retailer, doc_type,
           document_date::text as document_date, uploaded_at::text as uploaded_at,
           object_key, size_bytes, po_number
    from file_vault.stored_files
    where ${po} = any(string_to_array(po_number, ',')) and bucket in ${sql(vaults)}
    order by coalesce(document_date, uploaded_at::date, '0001-01-01'::date) desc,
             uploaded_at desc nulls last
  `;
  return (rows as unknown as PoDocument[]).map((r) => ({
    ...r,
    size_bytes: r.size_bytes == null ? null : Number(r.size_bytes),
  }));
}
