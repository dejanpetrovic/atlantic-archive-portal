import { NextRequest, NextResponse } from "next/server";
import { apiAuth } from "@/lib/api";
import { getStoredFile } from "@/lib/documents";
import { getSignedDownloadUrl } from "@/lib/b2";
import { logAccessStrict } from "@/lib/log";
import { isVault } from "@/lib/authz";

// Mint a short-lived B2 signed URL and redirect — bytes stream from B2,
// never through the app.
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

  const filename = file.object_key.split("/").pop() ?? "file";
  const url = await getSignedDownloadUrl(file.bucket, file.object_key, {
    validSeconds: 600,
    contentDisposition: `attachment; filename="${filename.replaceAll('"', "")}"`,
  });

  // Fail closed: no audit row, no download.
  await logAccessStrict(auth.user.id, "download", file.bucket, file.object_key);

  return NextResponse.redirect(url, 302);
}
