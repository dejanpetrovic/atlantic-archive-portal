import type { Metadata } from "next";
import { getReconciliationRuns, getVaultLag } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin · Health" };

export const dynamic = "force-dynamic";

function lagBadge(minutes: number | null) {
  if (minutes == null)
    return <span className="text-ink-faint">no data</span>;
  const days = minutes / 1440;
  const label =
    minutes < 120
      ? `${minutes} min`
      : minutes < 2880
        ? `${Math.round(minutes / 60)} h`
        : `${Math.round(days)} d`;
  const tone =
    days < 2 ? "text-ok" : days < 7 ? "text-warn" : "text-bad";
  return <span className={tone}>{label}</span>;
}

export default async function HealthPage() {
  const [lags, runs] = await Promise.all([
    getVaultLag(),
    getReconciliationRuns().catch(() => []),
  ]);

  const runColumns = runs.length ? Object.keys(runs[0]) : [];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
          Archive lag
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {lags.map((l) => (
            <div
              key={l.bucket}
              className="rounded-lg border border-edge bg-surface-1 p-4"
            >
              <div className="font-mono text-[11px] text-ink-dim">
                {l.bucket}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {lagBadge(l.lag_minutes)}
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-faint">
                {l.file_count.toLocaleString()} files · newest{" "}
                {l.newest_upload?.slice(0, 16).replace("T", " ") ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
          Reconciliation runs · latest {runs.length}
        </h2>
        {runs.length === 0 ? (
          <p className="rounded-lg border border-edge bg-surface-1 py-10 text-center text-ink-faint">
            No reconciliation runs recorded.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-edge">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-edge bg-surface-1 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                  {runColumns.map((c) => (
                    <th key={c} className="px-3 py-2 font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr key={i} className="border-b border-edge/50 hover:bg-surface-1">
                    {runColumns.map((c) => (
                      <td
                        key={c}
                        className="max-w-xs truncate px-3 py-1.5 font-mono text-[11px] text-ink-dim"
                        title={String(run[c] ?? "")}
                      >
                        {formatCell(run[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace("T", " ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
