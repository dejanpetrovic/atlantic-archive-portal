import { redirect } from "next/navigation";
import { atLeast, isAdmin, queryEffectiveLevels, requireUser } from "@/lib/authz";

// Home: forward to the first surface the user can see.
export default async function Home() {
  const user = await requireUser();
  const levels = await queryEffectiveLevels(user.id);

  if (atLeast(levels["acid-retailer-docs"], "search")) redirect("/documents");
  if (atLeast(levels["acid-order-docs"], "search")) redirect("/order-docs");
  if (atLeast(levels["acid-call-recordings"], "search")) redirect("/recordings");
  if (isAdmin(levels)) redirect("/admin");

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-xs tracking-widest text-ink-faint">
        NO ACCESS
      </p>
      <h1 className="mt-2 text-lg font-medium">
        Your account has no archive access
      </h1>
      <p className="mt-1 max-w-sm text-ink-dim">
        You are signed in, but no vault is visible to your account. Contact
        your admin to request access.
      </p>
    </div>
  );
}
