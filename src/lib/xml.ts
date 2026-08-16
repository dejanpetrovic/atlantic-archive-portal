// Client-safe XML display helpers (no dependencies, no server-only imports).

// Reindent an XML string: one node per line, two-space indent. Tolerant of
// arbitrary input — worst case it returns the original text.
export function prettyXml(xml: string): string {
  try {
    const compact = xml.replace(/>\s+</g, "><").trim();
    const withBreaks = compact.replace(/(>)(<)(\/*)/g, "$1\n$2$3");
    let indent = 0;
    const out: string[] = [];
    for (const line of withBreaks.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const isClosing = /^<\//.test(trimmed);
      const isSelfContained =
        /^<[^>]*\/>$/.test(trimmed) || // <a/>
        /^<[^>]+>[^<]*<\/[^>]+>$/.test(trimmed) || // <a>text</a>
        /^<[?!]/.test(trimmed); // declaration/comment
      if (isClosing) indent = Math.max(0, indent - 1);
      out.push("  ".repeat(indent) + trimmed);
      if (!isClosing && !isSelfContained && /^<[^/][^>]*>$/.test(trimmed)) {
        indent += 1;
      }
    }
    return out.join("\n");
  } catch {
    return xml;
  }
}

// Words worth highlighting from a websearch-style query: drop operators,
// quotes and one-letter fragments.
export function queryTerms(q: string): string[] {
  return q
    .split(/[\s"'()]+/)
    .map((t) => t.replace(/^-/, "").trim())
    .filter((t) => t.length >= 2 && !["or", "and", "not"].includes(t.toLowerCase()));
}

export function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
