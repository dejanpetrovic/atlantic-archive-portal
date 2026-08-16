"use client";

import { useState, useTransition } from "react";
import { clearGrant, setGrant } from "@/app/(portal)/admin/actions";

type Props = {
  userId: string;
  vault: string;
  effective: string;
  override: string | null; // explicit vault_grants level, if any
  canManage: boolean;
};

const LEVEL_COLORS: Record<string, string> = {
  none: "text-ink-faint",
  search: "text-link",
  download: "text-ok",
  manage: "text-accent",
};

export function GrantCell({
  userId,
  vault,
  effective,
  override,
  canManage,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  if (!canManage) {
    return (
      <span className={`font-mono text-xs ${LEVEL_COLORS[effective] ?? ""}`}>
        {effective}
      </span>
    );
  }

  const onChange = (value: string) => {
    setError(false);
    startTransition(async () => {
      const result =
        value === ""
          ? await clearGrant(userId, vault)
          : await setGrant(userId, vault, value);
      if (result.error) setError(true);
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={override ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className={`rounded border bg-surface-1 px-1 py-0.5 font-mono text-xs outline-none focus:border-accent-dim disabled:opacity-50 ${
          override ? "border-accent-dim" : "border-edge"
        } ${LEVEL_COLORS[effective] ?? ""}`}
        title={
          override
            ? "Explicit grant (overrides role default)"
            : `Role default: ${effective}`
        }
      >
        <option value="">default ({effective})</option>
        <option value="none">none</option>
        <option value="search">search</option>
        <option value="download">download</option>
        <option value="manage">manage</option>
      </select>
      {error && <span className="text-[11px] text-bad">failed</span>}
    </span>
  );
}
