"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LEVELS_COOKIE,
  encodeLevelsCookie,
  queryEffectiveLevels,
} from "@/lib/authz";
import { logAccess } from "@/lib/log";

export type LoginState = { error: string } | null;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      error:
        "Sign-in failed. Accounts are created by an administrator — if you need access, contact your admin.",
    };
  }

  // Cache effective levels in the session for nav rendering; enforcement
  // re-checks the DB on every request regardless.
  const levels = await queryEffectiveLevels(data.user.id);
  const cookieStore = await cookies();
  cookieStore.set(LEVELS_COOKIE, encodeLevelsCookie(data.user.id, levels), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  await logAccess(data.user.id, "login");
  redirect("/");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(LEVELS_COOKIE);
  redirect("/login");
}
