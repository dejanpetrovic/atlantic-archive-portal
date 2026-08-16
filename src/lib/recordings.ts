import "server-only";
import { db } from "./db";
import type { RecordingRow, RecordingSearchResponse } from "./types";

// file_vault.call_recordings is a view over stored_files
// (bucket = 'acid-call-recordings'), so `id` is the stored_files id the
// play/download routes need. Call metadata lives in the `meta` jsonb, in
// two dialects:
//  - backfill (through 2026-08-05): other_party, extension, lowercase
//    direction ('outgoing'/'incoming'); no duration.
//  - nightly (2026-08-06+): from_number, to_number, from_name,
//    duration_sec, extension_id, direction 'Outbound'/'Inbound'.
// Every projection below coalesces across both.

export type RecordingSearchParams = {
  phone: string; // raw user input; digits are extracted here
  direction: string | null; // 'incoming' | 'outgoing'
  dateFrom: string | null;
  dateTo: string | null;
  cursor: string | null;
  pageSize?: number;
};

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

function encodeCursor(startedAt: string | null, id: string): string {
  return Buffer.from(JSON.stringify({ t: startedAt, i: id })).toString(
    "base64url",
  );
}

function decodeCursor(
  cursor: string | null,
): { t: string; i: string } | null {
  if (!cursor) return null;
  try {
    const { t, i } = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { t: string | null; i: string };
    if (typeof i !== "string" || !/^\d+$/.test(i)) return null;
    const ts = t ?? TS_FLOOR;
    if (!/^[\d\s:.T+-]{10,32}$/.test(ts)) return null;
    return { t: ts, i };
  } catch {
    return null;
  }
}

const TS_FLOOR = "0001-01-01 00:00:00+00";

// 318k rows: always keyset-paginated, page size capped at 100.
export async function searchRecordings(
  p: RecordingSearchParams,
): Promise<RecordingSearchResponse> {
  const sql = db();
  const pageSize = Math.min(p.pageSize ?? 100, 100);
  const digits = normalizePhone(p.phone);

  const conds = [sql`true`];
  if (digits.length >= 7) {
    // Both dialects embed the numbers in file_name, which has a trigram
    // index — use it as an indexed prefilter, then suffix-match the actual
    // number fields of either dialect.
    conds.push(sql`cr.file_name like ${"%" + digits + "%"}`);
    conds.push(
      sql`(regexp_replace(coalesce(cr.meta->>'other_party', ''), '\\D', '', 'g')
          like ${"%" + digits}
        or regexp_replace(coalesce(cr.meta->>'from_number', ''), '\\D', '', 'g')
          like ${"%" + digits}
        or regexp_replace(coalesce(cr.meta->>'to_number', ''), '\\D', '', 'g')
          like ${"%" + digits})`,
    );
  }
  if (p.direction === "incoming") {
    conds.push(sql`lower(cr.meta->>'direction') in ('incoming', 'inbound')`);
  } else if (p.direction === "outgoing") {
    conds.push(sql`lower(cr.meta->>'direction') in ('outgoing', 'outbound')`);
  }
  if (p.dateFrom) conds.push(sql`cr.call_started_at >= ${p.dateFrom}::date`);
  if (p.dateTo) conds.push(sql`cr.call_started_at < (${p.dateTo}::date + 1)`);
  const where = conds.reduce((a, b) => sql`${a} and ${b}`);

  const cur = decodeCursor(p.cursor);
  const cursorCond = cur
    ? sql`and (coalesce(cr.call_started_at, ${TS_FLOOR}::timestamptz), cr.id)
          < (${cur.t}::timestamptz, ${cur.i}::bigint)`
    : sql``;

  const [rows, totalRows] = await Promise.all([
    sql`
      select cr.id::text as id,
             cr.id::text as stored_file_id,
             coalesce(
               cr.meta->>'other_party',
               case
                 when lower(cr.meta->>'direction') in ('outgoing', 'outbound')
                   then cr.meta->>'to_number'
                 else cr.meta->>'from_number'
               end
             ) as other_party,
             case
               when lower(cr.meta->>'direction') in ('incoming', 'inbound') then 'incoming'
               when lower(cr.meta->>'direction') in ('outgoing', 'outbound') then 'outgoing'
               else lower(cr.meta->>'direction')
             end as direction,
             coalesce(
               nullif(cr.meta->>'extension', ''),
               nullif(cr.meta->>'from_name', '')
             ) as agent,
             case
               when cr.meta->>'duration_sec' ~ '^\\d+$'
                 then (cr.meta->>'duration_sec')::int
             end as duration_seconds,
             cr.call_started_at::text as started_at,
             cr.size_bytes,
             cr.rc_recording_id as recording_id
      from file_vault.call_recordings cr
      where ${where} ${cursorCond}
      order by coalesce(cr.call_started_at, ${TS_FLOOR}::timestamptz) desc, cr.id desc
      limit ${pageSize}
    `,
    sql`
      select count(*)::int as total
      from file_vault.call_recordings cr
      where ${where}
    `,
  ]);

  const recRows: RecordingRow[] = (rows as unknown as RecordingRow[]).map(
    (r) => ({
      ...r,
      size_bytes: r.size_bytes == null ? null : Number(r.size_bytes),
      duration_seconds:
        r.duration_seconds == null ? null : Number(r.duration_seconds),
    }),
  );

  const last = recRows[recRows.length - 1];
  return {
    rows: recRows,
    total: (totalRows as unknown as { total: number }[])[0]?.total ?? 0,
    nextCursor:
      recRows.length === pageSize && last
        ? encodeCursor(last.started_at, last.id)
        : null,
  };
}
