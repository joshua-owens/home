# Home Projects & Expenses Tracker — Design

**Date:** 2026-07-11 (revised 2026-07-12 after grilling session)
**Status:** Approved design, pre-implementation

Domain vocabulary lives in the root `CONTEXT.md`; this spec uses those terms.

## Overview

A self-hosted web app for tracking homeowner projects, contractor quotes, expenses, and home inventory, with an AI research feature that generates cost/options reports for a project (e.g. "install a ductless mini split heat pump in an addition with no ductwork"). Runs as a single Docker container on an Unraid server, used by two people (one shared household — all data visible and editable by both accounts).

## Architecture

- **Nuxt 4.x monolith** — Vue frontend plus Nitro server routes (`server/api/`) in one codebase, one build, one container. Uses the Nuxt 4 directory structure (`app/` for the frontend, `server/` at root).
- **Nuxt UI 4.x** — component library for all UI (forms, tables, modals, toasts, sidebar layout), giving consistent styling and built-in dark mode with minimal custom CSS.
- **SQLite via TypeORM** — database file lives on a mounted volume. Schema changes are managed with proper TypeORM migrations (generated from entity diffs, applied automatically at server startup) — no hand-written DDL.
- **File storage** — uploaded attachments stored on disk under the same volume; metadata in DB.
- **AI research** — Nitro server route calls **OpenRouter** (OpenAI-compatible API at `https://openrouter.ai/api/v1`) using the OpenAI SDK. Model is configurable via `RESEARCH_MODEL` env var; web-search capability depends on the chosen model / OpenRouter `:online` variant. Model selection is deferred — to be researched later; the route treats it as pure config.
- **Auth** — `nuxt-auth-utils`: username + bcrypt password hash in SQLite, sealed session cookies. All API routes require a session.

### Deployment

- Single Dockerfile: Node build stage → slim runtime image.
- One volume at `/data` containing `sqlite.db` and `uploads/` — the entire backup surface.
- Env vars: `OPENROUTER_API_KEY`, `RESEARCH_MODEL`, `NUXT_SESSION_PASSWORD`.
- LAN-only on Unraid; plain HTTP acceptable, or behind an existing reverse proxy.
- First-run setup screen creates the initial account; additional accounts created from an admin section (which also handles password changes).

## Data model

- **User** — username, password hash, display name. No artificial account limit, but built for two. **No roles** — every user can create accounts, reset any password, and edit household settings. Lockout escape hatch: a documented CLI command inside the container resets a password against the SQLite file.
- **Project** — name, description, status (`idea`, `researching`, `quoting`, `in_progress`, `done`, `on_hold`), priority rank, created-by, created/updated dates. Status transitions are free-form (any → any).
  - **Two independent rankings:** the **Backlog** (`idea` + `on_hold`) and the **Active** list (`researching`, `quoting`, `in_progress`) are each drag-reorderable on their own. A project moving from Backlog to Active is appended to the bottom of the Active list. `done` projects are unranked.
- **Quote** — belongs to a Project: company name, contact info, amount, scope notes, date received, valid-until date, status (`pending` / `accepted` / `declined`), attachments.
  - Multiple accepted quotes per project are allowed (different scopes/trades); expected project cost = sum of accepted quotes.
  - "Expired" is a **derived display state** (pending + past valid-until), not a status — no timer job, and an expired quote can still be accepted.
  - Declined quotes are hidden from the default view behind a "show declined" toggle, never deleted, and can be returned to `pending` or `accepted`. Canonical term is **declined** (not "rejected").
- **Expense** — amount, date, vendor, note, category, receipt attachment; linked to a Project **or** standalone (general home expense). Expenses are not linked to specific quotes — spend vs. quote comparison happens at the project level.
  - **Categories** are rows in a `categories` table, seeded with maintenance / improvement / utilities / appliance / other, extensible from the admin UI (not a hardcoded enum).
- **HouseholdSettings** — singleton record: region/ZIP and optional house facts (age, size). Injected into research prompts so cost estimates are regional, not national averages.
- **InventoryItem** — name, location, brand/model/serial, purchase date, warranty expiry, notes, attachments (manuals, receipts). Covers appliances, paint colors, docs.
- **ResearchReport** — belongs to a Project: markdown body, generated-at timestamp, model used, status (`pending` / `complete` / `failed` with error message). Multiple reports per project allowed.
- **Attachment** — shared table (filename, mime type, size, disk path, owner entity); files on disk, metadata in DB. Limits: 25 MB per file; pdf, images, and txt only.

### Deletion

Hard delete with a confirmation dialog for projects (cascading quotes, expenses, reports, attachments), expenses, inventory items, and attachments; deleting a record removes its files from disk. The one exception: quotes are never deleted, only declined. No trash/restore.

## Pages & UI

Sidebar navigation; responsive for phone use on the LAN.

- **Dashboard** — Active projects in priority order (drag to reorder) with the Backlog shown separately, recent expenses, pending quotes expiring within 14 days, warranties expiring within 60 days.
- **Projects list** — filterable by status. Project detail page tabs:
  - **Overview** — description, status, activity.
  - **Quotes** — side-by-side comparison table with attachments.
  - **Expenses** — project spend vs. accepted quote amount.
  - **Research** — AI reports list + "Run research" button.
- **Expenses** — all expenses across the house, filterable by category/project/date range, with totals.
- **Inventory** — searchable list with warranty status badges.
- **Login** — username/password; admin section for account/password management.

## AI research flow

1. User clicks "Run research" on a project's Research tab.
2. Server route builds a prompt from the project's name and description, the HouseholdSettings (region, house facts), and any existing quotes on the project (including company names) so the model can sanity-check them. It creates a `pending` ResearchReport row, and kicks off generation in the background (in-memory pending flag + DB row — no job queue at this scale).
3. UI shows a "researching…" state and polls the report endpoint until `complete` or `failed`.
4. Report content: overview of options, typical cost ranges (equipment + install), factors affecting price, questions to ask contractors, red flags to watch for in quotes. Saved as markdown with timestamp and model name; re-runnable for comparison over time.
5. Failures are stored on the report row with the error message — never silently lost.
6. **Durability:** a run has a hard 5-minute timeout, after which it is marked `failed`. On server startup, any `pending` reports are marked `failed` with reason "interrupted by restart" (no persistent job queue; just re-run).

**Out of scope for v1:** a conversational chat assistant. The report feature's project-context-building code should be a reusable module so a chat layer can consume it later.

## Error handling

- API routes return typed errors; UI surfaces them as toast notifications.
- Research failures persisted (see above).

## Testing

- **Vitest** unit tests for server logic: data access, priority-rank ordering, research prompt building (OpenRouter client mocked).
- Component tests for the quote comparison table and drag-to-reorder interaction.

## Out of scope (v1)

- Chat assistant (planned follow-up).
- OAuth / SSO.
- Public hosting, multi-household support.
- Budgeting/forecasting features beyond per-project spend vs. quote.
