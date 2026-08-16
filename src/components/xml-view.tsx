"use client";

import { useMemo } from "react";
import { prettyXml, queryTerms } from "@/lib/xml";

// Renders pretty-printed XML with tag coloring and query-term highlighting.
// Everything is built as React nodes — no raw HTML injection.
export function XmlView({ xml, query }: { xml: string; query: string }) {
  const pretty = useMemo(() => prettyXml(xml), [xml]);
  const terms = useMemo(() => queryTerms(query), [query]);

  const termRegex = useMemo(() => {
    if (!terms.length) return null;
    const escaped = terms.map((t) =>
      t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return new RegExp(`(${escaped.join("|")})`, "gi");
  }, [terms]);

  const lines = useMemo(() => pretty.split("\n"), [pretty]);

  return (
    <pre className="overflow-x-auto rounded-lg border border-edge bg-surface-1 p-4 font-mono text-sm leading-6">
      {lines.map((line, i) => (
        <div key={i}>{renderLine(line, termRegex)}</div>
      ))}
    </pre>
  );
}

function renderLine(line: string, termRegex: RegExp | null) {
  // Split into tag and text segments; color tags, highlight text matches.
  const parts = line.split(/(<[^>]*>)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("<")) {
      return (
        <span key={i} className="text-link/80">
          {highlight(part, termRegex, true)}
        </span>
      );
    }
    return <span key={i}>{highlight(part, termRegex, false)}</span>;
  });
}

function highlight(
  text: string,
  termRegex: RegExp | null,
  inTag: boolean,
): React.ReactNode {
  if (!termRegex || inTag) return text;
  const pieces = text.split(termRegex);
  if (pieces.length === 1) return text;
  return pieces.map((piece, i) =>
    i % 2 === 1 ? <mark key={i}>{piece}</mark> : piece,
  );
}
