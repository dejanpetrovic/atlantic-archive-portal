"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="font-mono text-xs tracking-[0.3em] text-accent">
            ATLANTIC
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Archive portal
          </h1>
          <p className="mt-1 text-ink-dim">
            Retailer documents, order docs and call recordings.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-dim">
              Email
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              className="w-full rounded-md border border-edge bg-surface-1 px-3 py-2 outline-none transition-colors focus:border-accent-dim focus:bg-surface-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-dim">
              Password
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-edge bg-surface-1 px-3 py-2 outline-none transition-colors focus:border-accent-dim focus:bg-surface-2"
            />
          </label>

          {state?.error && (
            <p className="rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-accent px-3 py-2 font-medium text-surface-0 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-ink-faint">
          No self-service signup. Access is granted by an administrator.
        </p>
      </div>
    </main>
  );
}
