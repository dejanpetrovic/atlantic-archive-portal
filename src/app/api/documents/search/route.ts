import { NextRequest, NextResponse } from "next/server";
import { apiAuth } from "@/lib/api";
import { searchDocuments } from "@/lib/documents";
import { logAccess } from "@/lib/log";
import type { Vault } from "@/lib/authz";

const DOC_VAULTS: Vault[] = ["acid-retailer-docs", "acid-order-docs"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const vault = (params.get("vault") ?? "acid-retailer-docs") as Vault;
  if (!DOC_VAULTS.includes(vault)) {
    return NextResponse.json({ error: "bad vault" }, { status: 400 });
  }

  const auth = await apiAuth(vault, "search");
  if (!auth.ok) return auth.res;

  const q = (params.get("q") ?? "").slice(0, 500);
  const retailer = params.get("retailer");
  const docType = params.get("doc_type");
  const poNumber = params.get("po");
  const dateFrom = params.get("from");
  const dateTo = params.get("to");
  const cursor = params.get("cursor");

  const isDate = (s: string | null) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(dateFrom) || !isDate(dateTo)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }

  try {
    const result = await searchDocuments({
      vault,
      q,
      retailer,
      docType,
      poNumber,
      dateFrom,
      dateTo,
      cursor,
    });

    // Log first-page searches (not load-more) that actually filter something.
    if (!cursor && (q || retailer || docType || poNumber || dateFrom || dateTo)) {
      await logAccess(
        auth.user.id,
        "search",
        vault,
        undefined,
        JSON.stringify({
          q: q || undefined,
          retailer: retailer || undefined,
          doc_type: docType || undefined,
          po: poNumber || undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
        }),
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("document search failed", err);
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
