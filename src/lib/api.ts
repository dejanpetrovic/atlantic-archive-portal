import "server-only";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  atLeast,
  queryEffectiveLevels,
  getUser,
  type Level,
  type Vault,
} from "./authz";

export type ApiAuth =
  | { ok: true; user: User; level: Level }
  | { ok: false; res: NextResponse };

// Every route handler re-checks portal.effective_level — the UI hiding a
// surface is not enforcement.
export async function apiAuth(vault: Vault, min: Level): Promise<ApiAuth> {
  const user = await getUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  const levels = await queryEffectiveLevels(user.id);
  if (!atLeast(levels[vault], min)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user, level: levels[vault] };
}
