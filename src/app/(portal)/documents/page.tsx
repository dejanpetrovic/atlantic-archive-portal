import { Suspense } from "react";
import type { Metadata } from "next";
import { atLeast, requireLevelOrHome, requireUser } from "@/lib/authz";
import { DocSearch } from "@/components/doc-search";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const user = await requireUser();
  const level = await requireLevelOrHome(user.id, "acid-retailer-docs", "search");

  return (
    <Suspense>
      <DocSearch
        vault="acid-retailer-docs"
        canDownload={atLeast(level, "download")}
        detailPath="/documents"
        placeholder="Search retailer documents — try a PO, SKU, address, invoice number…"
      />
    </Suspense>
  );
}
