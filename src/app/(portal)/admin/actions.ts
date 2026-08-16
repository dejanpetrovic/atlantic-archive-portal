"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser, isVault, requireLevel, type Level } from "@/lib/authz";
import { logAccess } from "@/lib/log";

const GRANT_LEVELS: Level[] = ["none", "search", "download", "manage"];

export async function setGrant(
  userId: string,
  vault: string,
  level: string,
  note?: string,
): Promise<{ error?: string }> {
  const admin = await getUser();
  if (!admin) return { error: "unauthenticated" };
  if (!isVault(vault)) return { error: "bad vault" };
  if (!GRANT_LEVELS.includes(level as Level)) return { error: "bad level" };

  try {
    // Managing grants on a vault requires manage on that vault.
    await requireLevel(admin.id, vault, "manage");
  } catch {
    return { error: "forbidden" };
  }

  await db()`
    insert into portal.vault_grants (user_id, vault, level, granted_by, note)
    values (${userId}::uuid, ${vault}, ${level}, ${admin.id}::uuid, ${note ?? null})
    on conflict (user_id, vault) do update
      set level = excluded.level,
          granted_by = excluded.granted_by,
          granted_at = now(),
          note = excluded.note
  `;
  await logAccess(
    admin.id,
    "admin",
    vault,
    undefined,
    JSON.stringify({ op: "set_grant", target: userId, level }),
  );
  revalidatePath("/admin");
  return {};
}

// "Use default": remove the explicit override row.
export async function clearGrant(
  userId: string,
  vault: string,
): Promise<{ error?: string }> {
  const admin = await getUser();
  if (!admin) return { error: "unauthenticated" };
  if (!isVault(vault)) return { error: "bad vault" };

  try {
    await requireLevel(admin.id, vault, "manage");
  } catch {
    return { error: "forbidden" };
  }

  await db()`
    delete from portal.vault_grants
    where user_id = ${userId}::uuid and vault = ${vault}
  `;
  await logAccess(
    admin.id,
    "admin",
    vault,
    undefined,
    JSON.stringify({ op: "clear_grant", target: userId }),
  );
  revalidatePath("/admin");
  return {};
}
