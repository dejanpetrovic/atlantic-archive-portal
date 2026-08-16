import { Suspense } from "react";
import type { Metadata } from "next";
import { atLeast, requireLevelOrHome, requireUser } from "@/lib/authz";
import { DocSearch } from "@/components/doc-search";

export const metadata: Metadata = { title: "Order docs" };

export default async function OrderDocsPage() {
  const user = await requireUser();
  const level = await requireLevelOrHome(user.id, "acid-order-docs", "search");

  return (
    <Suspense>
      <DocSearch
        vault="acid-order-docs"
        canDownload={atLeast(level, "download")}
        detailPath="/order-docs"
        placeholder="Search order docs — text search covers natively extracted PDFs only…"
        showPoFilter
        showSearchableBadge
      />
    </Suspense>
  );
}
