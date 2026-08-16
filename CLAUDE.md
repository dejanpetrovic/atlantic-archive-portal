# Atlantic Archive Portal

Internal portal for searching and retrieving the company document archive:
Rithum EDI XML, order documents (PDFs from Monday), and RingCentral call
recordings. All objects live in Backblaze B2; all metadata and full-text
search live in Supabase Postgres (`file_vault` schema).

## Stack

- Next.js (App Router, TypeScript), Tailwind CSS
- Supabase Auth (shared with the existing inventory-control app — same
  project, same `auth.users`; do NOT create a separate user base)
- Deployed on Vercel
- Backblaze B2 native API for downloads/streaming (signed URLs, never proxied)

## Non-negotiable rules

1. **The Supabase service-role key never reaches the browser.** All
   `file_vault` and `portal` access goes through Next.js route handlers /
   server components using the service key from server-only env.
2. **`file_vault` is not exposed to PostgREST.** Query it with direct SQL
   from the server (postgres.js / node-postgres via the Supabase connection
   string) or via existing SECURITY DEFINER RPCs. Never add `file_vault`
   to the exposed schemas.
3. **Never write `content_fts`** — it is a stored generated column.
4. **No OCR anywhere.** Full-text search exists only for files whose text
   was extracted natively (XML now; electronic PDFs once the native-text
   sweep runs). Files without `content_text` are browsable by metadata only.
5. **B2 media/downloads stream directly from B2** using
   `b2_get_download_authorization` time-limited tokens (10–60 min). Never
   pipe file bytes through Vercel functions.
6. **Every search, view, download, and playback is logged** to
   `portal.access_log` (user_id, action, vault, object_key).
7. Enforce authorization **server-side on every request** via
   `portal.effective_level(user_id, vault)`:
   `none < search < download < manage`. `search` may see results and
   metadata but not fetch objects; `download` may fetch/play; `manage` is
   admin (user management, grants, audit log).

## Data model (already exists — do not recreate)

### `file_vault.stored_files` (383k rows)
Key columns: `id` (PK), `bucket`, `object_key`, `source`, `retailer`,
`doc_type`, `po_number`, `document_date`, `uploaded_at`, `size_bytes`,
`content_type`, `content_text`, `content_fts` (generated tsvector,
GIN-indexed), `extraction_method` ('native' | 'ocr' — we only use 'native').

Vaults (`bucket`):
- `acid-retailer-docs` — ~60k Rithum XML. Fully text-searchable.
  Facets: `retailer` (8 values), `doc_type` (neworders, poack,
  confirmations/shipping, invoices, fa), `document_date`.
- `acid-order-docs` — ~5.7k PDFs (BOLs, labels, order docs from Monday).
  Metadata browse by `po_number`; text search only for rows where the
  native-PDF sweep filled `content_text`.
- `acid-call-recordings` — 318k MP3s, 2020–2026, 167 GB.

### `file_vault.call_recordings`
Recording metadata: phone numbers, direction, extension, date, duration,
RingCentral recording id (13-digit, last `_`-separated field of filename).
Search by phone number (normalize input: strip non-digits, match on
suffix), date range, direction.

### `file_vault.po_lifecycle` (view)
One row per retailer+PO with `ordered_at`, `acked_at`, `shipped_at`,
`invoiced_at`. Powers the PO timeline page.

### `file_vault.reconciliation_runs`
Nightly archive-health results. Powers the health dashboard.

### `portal` schema (created 2026-08-16)
- `portal.vault_grants (user_id, vault, level, granted_by, granted_at, note)`
  — explicit per-user overrides only; role defaults come from the function.
- `portal.access_log (user_id, action, vault, object_key, detail, at)`
- `portal.effective_level(user uuid, vault text) -> text`
- `portal.users_overview` (view) — one row per auth user with role and
  effective level per vault; drives the admin user-management screen.

Role defaults (encoded in `effective_level`, do not duplicate in JS):
admin → manage on all vaults; other active profiles → download on the two
document vaults, none on recordings; inactive/no profile → none.

## Product surfaces

1. **Documents** (`acid-retailer-docs`) — full-text search with
   `websearch_to_tsquery`, `ts_headline` snippets, facet filters
   (retailer, doc_type, date range), keyboard-first. Row click → document
   view: pretty-printed XML with match highlighting + download.
2. **PO lookup** — enter a PO, render the lifecycle timeline from
   `po_lifecycle`, list every document for that PO across both doc vaults.
3. **Recordings** (`acid-call-recordings`) — search by phone number
   (suffix match), date range, direction; results as a virtualized table;
   inline `<audio>` playback via signed B2 URL. Admin-only by default.
4. **Order docs** (`acid-order-docs`) — browse/filter by PO and date;
   text search only over rows with `content_text`.
5. **Admin** — users (from `users_overview`), grant editor (upsert/delete
   `vault_grants` rows), audit log viewer, health dashboard
   (`reconciliation_runs` + archive lag per vault).

## Design direction

Dense, dark, keyboard-driven. Command palette (⌘K) that searches across
surfaces. Instant search (debounced server queries). No generic admin
template look. Mobile-usable but desktop-first.

## Environment variables (server-only unless prefixed NEXT_PUBLIC_)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (auth only)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (direct Postgres connection string, pooled)
- `B2_KEY_ID`, `B2_APP_KEY` (read-only key scoped to the three buckets)
- `B2_ACCOUNT_ID`

## Testing note

The three vaults differ by 4 orders of magnitude in row count. Any
recordings query must be checked against 318k rows — always paginate
(keyset, not OFFSET) and cap page size at 100.
