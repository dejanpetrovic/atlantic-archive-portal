import "server-only";
import { db } from "./db";

export type AccessAction =
  | "login"
  | "search"
  | "view"
  | "download"
  | "play"
  | "admin";

// Rule 6: every search, view, download and playback is logged.
// Failures are swallowed after logging to stderr — an audit-log hiccup must
// not take down the request — except that callers who need logging to be
// mandatory (downloads) use logAccessStrict.
export async function logAccess(
  userId: string,
  action: AccessAction,
  vault?: string,
  objectKey?: string,
  detail?: string,
): Promise<void> {
  try {
    await logAccessStrict(userId, action, vault, objectKey, detail);
  } catch (err) {
    console.error("access_log insert failed", { action, vault, err });
  }
}

export async function logAccessStrict(
  userId: string,
  action: AccessAction,
  vault?: string,
  objectKey?: string,
  detail?: string,
): Promise<void> {
  await db()`
    insert into portal.access_log (user_id, action, vault, object_key, detail)
    values (${userId}::uuid, ${action}, ${vault ?? null}, ${objectKey ?? null}, ${detail ?? null})
  `;
}
