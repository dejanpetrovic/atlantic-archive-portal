import { atLeast, getNavLevels, isAdmin, requireUser } from "@/lib/authz";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { CommandPalette } from "@/components/command-palette";
import Link from "next/link";
import { logout } from "@/app/login/actions";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const levels = await getNavLevels(user.id);

  const items: NavItem[] = [];
  if (atLeast(levels["acid-retailer-docs"], "search"))
    items.push({ href: "/documents", label: "Documents" });
  if (
    atLeast(levels["acid-retailer-docs"], "search") ||
    atLeast(levels["acid-order-docs"], "search")
  )
    items.push({ href: "/po", label: "PO lookup" });
  if (atLeast(levels["acid-order-docs"], "search"))
    items.push({ href: "/order-docs", label: "Order docs" });
  if (atLeast(levels["acid-call-recordings"], "search"))
    items.push({ href: "/recordings", label: "Recordings" });
  if (isAdmin(levels)) items.push({ href: "/admin", label: "Admin" });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface-0/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] tracking-[0.25em] text-accent">
              ATLANTIC
            </span>
            <span className="text-[13px] font-medium text-ink-dim">
              archive
            </span>
          </Link>
          <NavLinks items={items} />
          <div className="ml-auto flex items-center gap-3">
            <kbd className="hidden rounded border border-edge bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
              ⌘K
            </kbd>
            <span className="hidden font-mono text-[11px] text-ink-faint sm:block">
              {user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded px-2 py-1 text-[12px] text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        {children}
      </main>
      <CommandPalette
        surfaces={{
          documents: atLeast(levels["acid-retailer-docs"], "search"),
          po:
            atLeast(levels["acid-retailer-docs"], "search") ||
            atLeast(levels["acid-order-docs"], "search"),
          orderDocs: atLeast(levels["acid-order-docs"], "search"),
          recordings: atLeast(levels["acid-call-recordings"], "search"),
          admin: isAdmin(levels),
        }}
      />
    </div>
  );
}
