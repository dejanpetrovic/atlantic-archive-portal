import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Supabase client for server components, server actions and route handlers.
// Used for auth only — all data access goes through direct SQL (src/lib/db.ts).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component — cookie writes are not allowed
            // there; middleware handles session refresh instead.
          }
        },
      },
    },
  );
}
