import "server-only";
import { db } from "./db";
import type { RecordingRow, RecordingSearchResponse } from "./types";

// Assumed column names on file_vault.call_recordings (adjust here if the
// production schema differs): id, object_key, from_number, to_number,
// direction, extension, started_at, duration_seconds, recording_id.
// stored_files supplies the playable object via bucket+object_key.

export type RecordingSearchParams = {
  phone: string; // raw user input; digits are extracted here
  direction: string | null;
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
    if (typeof i !== "string") return null;
    const ts = t ?? "0001-01-01 00:00:00";
    if (!/^[\d\s:.T+-]{10,32}$/.test(ts)) return null;
    return { t: ts, i };
  } catch {
    return null;
  }
}

const TS_FLOOR = "0001-01-01 00:00:00";

// 318k rows: always keyset-paginated, page size capped at 100.
export async function searchRecordings(
  p: RecordingSearchParams,
): Promise<RecordingSearchResponse> {
  const sql = db();
  const pageSize = Math.min(p.pageSize ?? 100, 100);
  const digits = normalizePhone(p.phone);

  const conds = [sql`true`];
  if (digits.length >= 7) {
    const suffix = `%${digits}`;
    conds.push(
      sql`(regexp_replace(coalesce(cr.from_number, ''), '\\D', '', 'g') like ${suffix}
        or regexp_replace(coalesce(cr.to_number, ''), '\\D', '', 'g') like ${suffix})`,
    );
  }
  if (p.direction) conds.push(sql`lower(cr.direction) = ${p.direction.toLowerCase()}`);
  if (p.dateFrom) conds.push(sql`cr.started_at >= ${p.dateFrom}::date`);
  if (p.dateTo) conds.push(sql`cr.started_at < (${p.dateTo}::date + 1)`);
  const where = conds.reduce((a, b) => sql`${a} and ${b}`);

  const cur = decodeCursor(p.cursor);
  const cursorCond = cur
    ? sql`and (coalesce(cr.started_at, ${TS_FLOOR}::timestamp), cr.id::text)
          < (${cur.t}::timestamp, ${cur.i})`
    : sql``;

  const [rows, totalRows] = await Promise.all([
    sql`
      select cr.id::text as id,
             sf.id::text as stored_file_id,
             cr.from_number, cr.to_number, cr.direction, cr.extension::text as extension,
             cr.started_at::text as started_at,
             cr.duration_seconds, cr.recording_id::text as recording_id
      from file_vault.call_recordings cr
      left join file_vault.stored_files sf
        on sf.bucket = 'acid-call-recordings' and sf.object_key = cr.object_key
      where ${where} ${cursorCond}
      order by coalesce(cr.started_at, ${TS_FLOOR}::timestamp) desc, cr.id::text desc
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
