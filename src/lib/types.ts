// Shared shapes between route handlers and client components.

export type FacetCount = { value: string; count: number };

export type DocRow = {
  id: string;
  retailer: string | null;
  doc_type: string | null;
  po_number: string | null;
  document_date: string | null;
  object_key: string;
  size_bytes: number | null;
  /** Sanitized HTML: escaped text with <mark> around matches. */
  snippet: string | null;
  searchable: boolean;
};

export type DocSearchResponse = {
  rows: DocRow[];
  facets: { retailer: FacetCount[]; doc_type: FacetCount[] };
  total: number;
  nextCursor: string | null;
};

export type RecordingRow = {
  id: string;
  stored_file_id: string | null;
  other_party: string | null;
  direction: string | null;
  extension: string | null;
  started_at: string | null;
  size_bytes: number | null;
  recording_id: string | null;
};

export type RecordingSearchResponse = {
  rows: RecordingRow[];
  total: number;
  nextCursor: string | null;
};
