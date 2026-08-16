import { NextRequest, NextResponse } from "next/server";
import { apiAuth } from "@/lib/api";
import { getStoredFile } from "@/lib/documents";
import { getSignedDownloadUrl } from "@/lib/b2";
import { logAccessStrict } from "@/lib/log";
import { isVault } from "@/lib/authz";

// Inline variant used as <audio>/<iframe> src: redirects to a short-lived
// signed B2 URL. Fetching bytes requires download level; recordings log
// `play`, documents log `view`.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const file = await getStoredFile(id);
  if (!file || !isVault(file.bucket)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const auth = await apiAuth(file.bucket, "download");
  if (!auth.ok) return auth.res;

  const url = await getSignedDownloadUrl(file.bucket, file.object_key, {
    validSeconds: 600,
  });

  const action = file.bucket === "acid-call-recordings" ? "play" : "view";
  await logAccessStrict(auth.user.id, action, file.bucket, file.object_key);

  return NextResponse.redirect(url, 302);
}
