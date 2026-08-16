import "server-only";
import { db } from "./db";
import { VAULTS, type Level, type Vault } from "./authz";

// users_overview exposes user_id, email, full_name, role, active,
// last_sign_in_at plus per-vault level columns; effective levels are still
// computed live via effective_level so grant edits reflect immediately.
export type AdminUser = {
  user_id: string;
  email: string | null;
  role: string | null;
  active: boolean | null;
  last_sign_in_at: string | null;
  levels: Record<Vault, Level>;
  overrides: Partial<Record<Vault, Level>>;
};

export async function listUsers(): Promise<AdminUser[]> {
  const sql = db();
  const [users, grants] = await Promise.all([
    sql`
      select uo.user_id::text as user_id, uo.email, uo.role, uo.active,
             uo.last_sign_in_at::text as last_sign_in_at,
             portal.effective_level(uo.user_id, 'acid-retailer-docs') as lvl_retailer,
             portal.effective_level(uo.user_id, 'acid-order-docs') as lvl_order,
             portal.effective_level(uo.user_id, 'acid-call-recordings') as lvl_recordings
      from portal.users_overview uo
      order by uo.email nulls last
    `,
    sql`
      select user_id::text as user_id, vault, level
      from portal.vault_grants
    `,
  ]);

  const overridesByUser = new Map<string, Partial<Record<Vault, Level>>>();
  for (const g of grants as unknown as {
    user_id: string;
    vault: Vault;
    level: Level;
  }[]) {
    const entry = overridesByUser.get(g.user_id) ?? {};
    entry[g.vault] = g.level;
    overridesByUser.set(g.user_id, entry);
  }

  return (users as unknown as Record<string, unknown>[]).map((u) => ({
    user_id: u.user_id as string,
    email: u.email as string | null,
    role: u.role as string | null,
    active: u.active as boolean | null,
    last_sign_in_at: u.last_sign_in_at as string | null,
    levels: {
      "acid-retailer-docs": u.lvl_retailer as Level,
      "acid-order-docs": u.lvl_order as Level,
      "acid-call-recordings": u.lvl_recordings as Level,
    },
    overrides: overridesByUser.get(u.user_id as string) ?? {},
  }));
}

export type AuditFilters = {
  email: string | null;
  vault: string | null;
  action: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  /** Keyset cursor: `at` of the last row seen (microsecond precision). */
  before: string | null;
};

export type AuditRow = {
  user_id: string;
  email: string | null;
  action: string;
  vault: string | null;
  object_key: string | null;
  detail: string | null;
  at: string;
};

export async function queryAuditLog(f: AuditFilters): Promise<AuditRow[]> {
  const sql = db();
  const conds = [sql`true`];
  if (f.email) conds.push(sql`uo.email ilike ${"%" + f.email + "%"}`);
  if (f.vault) conds.push(sql`al.vault = ${f.vault}`);
  if (f.action) conds.push(sql`al.action = ${f.action}`);
  if (f.dateFrom) conds.push(sql`al.at >= ${f.dateFrom}::date`);
  if (f.dateTo) conds.push(sql`al.at < (${f.dateTo}::date + 1)`);
  if (f.before) conds.push(sql`al.at < ${f.before}::timestamptz`);
  const where = conds.reduce((a, b) => sql`${a} and ${b}`);

  const rows = await sql`
    select al.user_id::text as user_id, uo.email, al.action, al.vault,
           al.object_key, al.detail, al.at::text as at
    from portal.access_log al
    left join portal.users_overview uo on uo.user_id = al.user_id
    where ${where}
    order by al.at desc
    limit 100
  `;
  return rows as unknown as AuditRow[];
}

export type VaultLag = {
  bucket: Vault;
  newest_upload: string | null;
  lag_minutes: number | null;
  file_count: number;
};

export async function getVaultLag(): Promise<VaultLag[]> {
  const rows = await db()`
    select bucket, max(uploaded_at)::text as newest_upload,
           (extract(epoch from (now() - max(uploaded_at))) / 60)::int as lag_minutes,
           count(*)::int as file_count
    from file_vault.stored_files
    group by bucket
  `;
  const byBucket = new Map(
    (rows as unknown as VaultLag[]).map((r) => [r.bucket, r]),
  );
  return VAULTS.map(
    (v) =>
      byBucket.get(v) ?? {
        bucket: v,
        newest_upload: null,
        lag_minutes: null,
        file_count: 0,
      },
  );
}

// Schema intentionally unspecified in the portal — render whatever the
// nightly job records.
export async function getReconciliationRuns(): Promise<
  Record<string, unknown>[]
> {
  const rows = await db()`
    select * from file_vault.reconciliation_runs
    order by 1 desc
    limit 20
  `;
  return rows as unknown as Record<string, unknown>[];
}
