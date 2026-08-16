import type { Metadata } from "next";
import { listUsers } from "@/lib/admin";
import {
  VAULTS,
  queryEffectiveLevels,
  requireUser,
  type Vault,
} from "@/lib/authz";
import { GrantCell } from "@/components/grant-cell";

export const metadata: Metadata = { title: "Admin · Users" };

const VAULT_SHORT: Record<Vault, string> = {
  "acid-retailer-docs": "Docs",
  "acid-order-docs": "Order docs",
  "acid-call-recordings": "Recordings",
};

export default async function AdminUsersPage() {
  const admin = await requireUser();
  const [adminLevels, users] = await Promise.all([
    queryEffectiveLevels(admin.id),
    listUsers(),
  ]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-edge font-mono text-[11px] tracking-widest text-ink-faint uppercase">
            <th className="py-2 pr-3 font-normal">User</th>
            <th className="py-2 pr-3 font-normal">Role</th>
            <th className="py-2 pr-3 font-normal">Active</th>
            <th className="py-2 pr-3 font-normal">Last sign-in</th>
            {VAULTS.map((v) => (
              <th key={v} className="py-2 pr-3 font-normal">
                {VAULT_SHORT[v]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.user_id}
              className="border-b border-edge/50 hover:bg-surface-1"
            >
              <td className="py-1.5 pr-3">
                <span className="text-ink">{u.email ?? u.user_id}</span>
              </td>
              <td className="py-1.5 pr-3 font-mono text-xs text-ink-dim">
                {u.role ?? "—"}
              </td>
              <td className="py-1.5 pr-3">
                {u.active === false ? (
                  <span className="text-bad">inactive</span>
                ) : (
                  <span className="text-ok">active</span>
                )}
              </td>
              <td className="py-1.5 pr-3 font-mono text-xs text-ink-dim">
                {u.last_sign_in_at?.slice(0, 16).replace("T", " ") ?? "never"}
              </td>
              {VAULTS.map((v) => (
                <td key={v} className="py-1.5 pr-3">
                  <GrantCell
                    userId={u.user_id}
                    vault={v}
                    effective={u.levels[v]}
                    override={u.overrides[v] ?? null}
                    canManage={adminLevels[v] === "manage"}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-faint">
        Levels come from role defaults unless an explicit grant is set
        (outlined selects). “default” deletes the override row.
      </p>
    </div>
  );
}
