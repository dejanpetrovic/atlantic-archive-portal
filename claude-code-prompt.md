# Claude Code prompt — Atlantic Archive Portal

Paste this as the first message in Claude Code, in a repo containing only
`CLAUDE.md` (and this file). Work in phases; commit at the end of each.

---

Read CLAUDE.md fully before writing anything. It defines the data model,
the security rules, and the role defaults — all of it already exists in
production Supabase; you are building only the web app.

Build the portal in this order, committing after each phase:

**Phase 1 — Skeleton + auth.**
Next.js App Router + TypeScript + Tailwind. Supabase Auth with email/
password against the existing project (users already exist — no signup
flow, no user creation; login only, plus a "contact your admin" message
on failure). Middleware guards every route. After login, load the user's
effective level for each vault via one SQL call to
`portal.effective_level` for the three vaults, cache it in the session,
and drive navigation from it: a user sees only the surfaces they have at
least `search` on. Log `login` to `portal.access_log`.

**Phase 2 — Documents search (`acid-retailer-docs`).**
Server route: `websearch_to_tsquery('english', $q)` against `content_fts`,
optional filters retailer / doc_type / date range, `ts_headline` snippet,
keyset pagination, 50 per page. UI: single search input focused on load,
facet sidebar with live counts, result rows showing retailer, doc_type,
date, PO, snippet with highlighted matches. Document page: fetch
`content_text`, pretty-print the XML, highlight query matches, download
button (only if level ≥ download) hitting a route that mints a B2 signed
URL and logs `download`. Log `search` with the query in `detail`.

**Phase 3 — PO lookup.**
Input a PO number → timeline from `file_vault.po_lifecycle` (ordered →
acked → shipped → invoiced, showing gaps as pending), plus every document
across both doc vaults with that `po_number`, newest first. Make PO values
in search results link here.

**Phase 4 — Recordings (`acid-call-recordings` + `call_recordings`).**
Search by phone number (strip non-digits from input, suffix-match ≥ 7
digits), date range, direction. Virtualized results table (318k rows —
keyset pagination, page cap 100). Inline playback: `<audio>` element with
src = short-lived B2 signed URL minted server-side per play; log `play`.
Download button logs `download`. This entire surface renders only for
users whose effective level on this vault ≥ search (today: admins).

**Phase 5 — Order docs (`acid-order-docs`).**
Browse/filter by PO and date. Where `content_text` exists, include rows
in full-text search with a "searchable" badge; otherwise metadata only.
PDF viewing via signed URL in an iframe/object tag; same download rules.

**Phase 6 — Admin.**
Visible only at `manage` level. Users table from `portal.users_overview`
(name, email, role, active, last sign-in, effective level per vault).
Grant editor: per user, per vault, set explicit level or "use default"
(delete the override row); write `granted_by` and log `admin` actions.
Audit log viewer with filters (user, vault, action, date). Health
dashboard: latest `reconciliation_runs` results and per-vault archive lag
(minutes since newest `uploaded_at`).

**Phase 7 — Command palette + polish.**
⌘K palette: type to search documents, a PO pattern jumps to PO lookup, a
phone-number pattern jumps to recordings (if permitted). Dark, dense,
keyboard-first throughout — this is a tool users live in, not a template.
Empty states, loading skeletons, error toasts.

Constraints, absolute:
- Service key and DB URL server-side only. No `file_vault` via PostgREST.
- Never write `content_fts`. Never proxy file bytes through the app.
- Authorization enforced in every route handler by re-checking
  `portal.effective_level` — the UI hiding a surface is not enforcement.
- No OCR, no external services beyond Supabase and B2.

Ask me for env values when you reach the first point you need them; put
placeholders in `.env.example` from the list in CLAUDE.md.
