# Atlantic Archive Portal

Internal portal for searching and retrieving the company document archive:
Rithum EDI XML, order documents (PDFs), and RingCentral call recordings.
Objects live in Backblaze B2; metadata and full-text search live in
Supabase Postgres (`file_vault` schema). See `CLAUDE.md` for the full data
model and security rules.

## Surfaces

- **Documents** — full-text search over retailer EDI XML with facets,
  snippets, pretty-printed document view, downloads via signed B2 URLs.
- **PO lookup** — lifecycle timeline (ordered → acked → shipped → invoiced)
  plus every archived document for a PO.
- **Recordings** — phone-suffix/date/direction search over 318k calls with
  inline playback (admin-only by default).
- **Order docs** — browse by PO/date, PDF preview, text search where native
  extraction exists.
- **Admin** — user/grant management, audit log, archive health.
- **⌘K** — command palette: document search, PO and phone-number jumps.

## Development

```bash
cp .env.example .env.local   # fill in values (see below)
npm install
npm run dev
```

Environment variables (all server-only except the `NEXT_PUBLIC_*` pair used
for Supabase auth) are listed in `.env.example`. The B2 key must be a
read-only key scoped to the three archive buckets; the DB URL is the pooled
Supabase connection string.

## Security invariants

- Service-role key and DB URL never reach the browser; all `file_vault` /
  `portal` access is direct SQL from the server.
- Authorization is re-checked server-side on every request via
  `portal.effective_level` — UI visibility is not enforcement.
- File bytes stream directly from B2 via time-limited signed URLs; the app
  only ever issues 302s.
- Every login, search, view, download, playback and admin action is written
  to `portal.access_log`.
