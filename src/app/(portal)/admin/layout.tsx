import { redirect } from "next/navigation";
import { isAdmin, queryEffectiveLevels, requireUser } from "@/lib/authz";
import { NavLinks } from "@/components/nav-links";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const levels = await queryEffectiveLevels(user.id);
  if (!isAdmin(levels)) redirect("/");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 border-b border-edge pb-3">
        <h1 className="text-base font-semibold tracking-tight">Admin</h1>
        <NavLinks
          items={[
            { href: "/admin", label: "Users & grants", exact: true },
            { href: "/admin/audit", label: "Audit log" },
            { href: "/admin/health", label: "Health" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
