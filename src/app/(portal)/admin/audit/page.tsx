import Link from "next/link";
import type { Metadata } from "next";
import { queryAuditLog } from "@/lib/admin";
import { VAULTS } from "@/lib/authz";

export const metadata: Metadata = { title: "Admin · Audit log" };

const ACTIONS = ["login", "search", "view", "download", "play", "admin"];

type Search = {
  email?: string;
  vault?: string;
  action?: string;
  from?: string;
  to?: string;
  before?: string;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const rows = await queryAuditLog({
    email: sp.email || null,
    vault: sp.vault || null,
    action: sp.action || null,
    dateFrom: sp.from || null,
    dateTo: sp.to || null,
    before: sp.before || null,
  });

  const last = rows[rows.length - 1];
  const nextParams = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== "before") as [
      string,
      string,
    ][],
  );
  if (last) nextParams.set("before", last.at);

  return (
    <div className="space-y-3">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="email"
          defaultValue={sp.email ?? ""}
          placeholder="User email"
          className="w-48 rounded border border-edge bg-surface-1 px-2 py-1.5 text-xs outline-none focus:border-accent-dim"
        />
        <select
          name="vault"
          defaultValue={sp.vault ?? ""}
          className="rounded border border-edge bg-surface-1 px-2 py-1.5 text-xs outline-none"
        >
          <option value="">Any vault</option>
          {VAULTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={sp.action ?? ""}
          className="rounded border border-edge bg-surface-1 px-2 py-1.5 text-xs outline-none"
        >
          <option value="">Any action</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ""}
          className="rounded border border-edge bg-surface-1 px-2 py-1 text-xs outline-none"
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ""}
          className="rounded border border-edge bg-surface-1 px-2 py-1 text-xs outline-none"
        />
        <button
          type="submit"
          className="rounded bg-surface-3 px-3 py-1.5 text-xs text-ink transition-colors hover:bg-edge"
        >
          Filter
        </button>
        {(sp.email || sp.vault || sp.action || sp.from || sp.to) && (
          <Link href="/admin/audit" className="text-xs text-link hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-edge font-mono text-[11px] tracking-widest text-ink-faint uppercase">
              <th className="py-2 pr-3 font-normal">At</th>
              <th className="py-2 pr-3 font-normal">User</th>
              <th className="py-2 pr-3 font-normal">Action</th>
              <th className="py-2 pr-3 font-normal">Vault</th>
              <th className="py-2 pr-3 font-normal">Object / detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-ink-faint">
                  No log entries match.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-edge/50 hover:bg-surface-1">
                <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap text-ink-dim">
                  {r.at.slice(0, 19).replace("T", " ")}
                </td>
                <td className="py-1.5 pr-3">{r.email ?? r.user_id}</td>
                <td className="py-1.5 pr-3">
                  <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px]">
                    {r.action}
                  </span>
                </td>
                <td className="py-1.5 pr-3 font-mono text-xs text-ink-dim">
                  {r.vault?.replace("acid-", "") ?? "—"}
                </td>
                <td className="max-w-md py-1.5 pr-3">
                  <span
                    className="block truncate font-mono text-xs text-ink-faint"
                    title={r.object_key ?? r.detail ?? ""}
                  >
                    {r.object_key ?? r.detail ?? "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 100 && (
        <Link
          href={`/admin/audit?${nextParams}`}
          className="block rounded border border-edge bg-surface-1 py-2 text-center text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Older entries →
        </Link>
      )}
    </div>
  );
}
