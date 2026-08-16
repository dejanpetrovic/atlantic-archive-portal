"use client";

import { useState } from "react";
import type { SheetPreview } from "@/lib/preview";

// Spreadsheet/CSV preview: first row as header, sheet tabs for multi-sheet
// workbooks, horizontal scroll for wide files.
export function SheetTable({
  sheets,
  maxRows,
}: {
  sheets: SheetPreview[];
  maxRows: number;
}) {
  const [active, setActive] = useState(0);
  const sheet = sheets[active] ?? sheets[0];
  if (!sheet) return null;
  const [header, ...body] = sheet.rows;
  const truncated = sheet.totalRows > sheet.rows.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {sheets.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActive(i)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                i === active
                  ? "bg-surface-3 text-ink"
                  : "text-ink-dim hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-edge bg-surface-1">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              {(header ?? []).map((h, i) => (
                <th
                  key={i}
                  className="border-b border-edge px-3 py-2 text-left font-medium whitespace-nowrap text-ink"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {body.map((row, r) => (
              <tr key={r} className="hover:bg-surface-2/50">
                {(header ?? row).map((_, c) => (
                  <td
                    key={c}
                    className="border-b border-edge/50 px-3 py-1.5 whitespace-nowrap text-ink-dim"
                  >
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="text-xs text-warn">
          Showing first {maxRows.toLocaleString()} of{" "}
          {sheet.totalRows.toLocaleString()} rows — download for the full file.
        </p>
      )}
    </div>
  );
}
