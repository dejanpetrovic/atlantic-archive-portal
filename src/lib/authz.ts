import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { createClient } from "./supabase/server";

export const VAULTS = [
  "acid-retailer-docs",
  "acid-order-docs",
  "acid-call-recordings",
] as const;
export type Vault = (typeof VAULTS)[number];
export type Level = "none" | "search" | "download" | "manage";
export type VaultLevels = Record<Vault, Level>;

const RANK: Record<Level, number> = {
  none: 0,
  search: 1,
  download: 2,
  manage: 3,
};

export function atLeast(level: Level | undefined, min: Level): boolean {
  return RANK[level ?? "none"] >= RANK[min];
}

export function isVault(v: string): v is Vault {
  return (VAULTS as readonly string[]).includes(v);
}

// Session cache for the nav: set as an httpOnly cookie at login so the shell
// renders without a DB round-trip. Never used for enforcement — every page
// and route handler re-checks portal.effective_level via requireLevel().
export const LEVELS_COOKIE = "portal_levels";

export function encodeLevelsCookie(userId: string, levels: VaultLevels) {
  return JSON.stringify({ u: userId, l: levels });
}

function decodeLevelsCookie(
  raw: string | undefined,
  userId: string,
): VaultLevels | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { u?: string; l?: VaultLevels };
    if (parsed.u !== userId || !parsed.l) return null;
    const levels = parsed.l;
    if (VAULTS.every((v) => levels[v] in RANK)) return levels;
    return null;
  } catch {
    return null;
  }
}

// One SQL call for all three vaults. Deduplicated per request via cache().
export const queryEffectiveLevels = cache(
  async (userId: string): Promise<VaultLevels> => {
    const rows = await db()<{ vault: Vault; level: Level }[]>`
      select v.vault, portal.effective_level(${userId}::uuid, v.vault) as level
      from (values
        ('acid-retailer-docs'),
        ('acid-order-docs'),
        ('acid-call-recordings')
      ) as v(vault)
    `;
    const levels = Object.fromEntries(
      rows.map((r) => [r.vault, r.level]),
    ) as VaultLevels;
    for (const v of VAULTS) levels[v] = levels[v] ?? "none";
    return levels;
  },
);

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// For pages: current user or redirect to /login (middleware should already
// have caught this; defense in depth).
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Nav-only levels: cookie cache when present, otherwise a fresh query.
export async function getNavLevels(userId: string): Promise<VaultLevels> {
  const cookieStore = await cookies();
  const cached = decodeLevelsCookie(
    cookieStore.get(LEVELS_COOKIE)?.value,
    userId,
  );
  return cached ?? (await queryEffectiveLevels(userId));
}

export class ForbiddenError extends Error {
  constructor(vault: Vault, min: Level) {
    super(`Requires ${min} on ${vault}`);
    this.name = "ForbiddenError";
  }
}

// Enforcement: fresh check of portal.effective_level for this request.
// Every route handler and gated page calls this — the UI hiding a surface
// is not enforcement.
export async function requireLevel(
  userId: string,
  vault: Vault,
  min: Level,
): Promise<Level> {
  const levels = await queryEffectiveLevels(userId);
  if (!atLeast(levels[vault], min)) throw new ForbiddenError(vault, min);
  return levels[vault];
}

// Same, for pages: redirects home instead of throwing.
export async function requireLevelOrHome(
  userId: string,
  vault: Vault,
  min: Level,
): Promise<Level> {
  const levels = await queryEffectiveLevels(userId);
  if (!atLeast(levels[vault], min)) redirect("/");
  return levels[vault];
}

export function isAdmin(levels: VaultLevels): boolean {
  return VAULTS.some((v) => levels[v] === "manage");
}
