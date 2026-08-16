import { Suspense } from "react";
import type { Metadata } from "next";
import { atLeast, requireLevelOrHome, requireUser } from "@/lib/authz";
import { RecordingsSearch } from "@/components/recordings-search";

export const metadata: Metadata = { title: "Recordings" };

export default async function RecordingsPage() {
  const user = await requireUser();
  const level = await requireLevelOrHome(
    user.id,
    "acid-call-recordings",
    "search",
  );

  return (
    <Suspense>
      <RecordingsSearch canPlay={atLeast(level, "download")} />
    </Suspense>
  );
}
