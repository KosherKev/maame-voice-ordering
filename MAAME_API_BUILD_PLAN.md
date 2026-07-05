# Maame API Build Plan

Sequential phases, each building on the last. No phase starts until the previous phase's acceptance criteria are met. Phases reference `MAAME_API_CONTRACT.md` sections and `MAAME_SPEC.md` gap numbers (G-1 through G-9).

---

## Phase 0 — Project Bootstrap (Supabase-based — supersedes any earlier local Postgres/Redis/custom-JWT bootstrap)

**Goal**: prove the infrastructure works before any feature code is written.

- [ ] Create the Supabase project (or confirm the existing one), note `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- [ ] Scaffold Node.js + TypeScript repo: `package.json`, `tsconfig.json`, ESLint + Prettier config
- [ ] Wire Prisma against the Supabase Postgres connection string, scoped to the custom-backend-owned tables only (orders, order_items, vendor_fulfillments, payments, disbursements, call_sessions, ussd_sessions, webhook_events, idempotency_keys) — **not** vendors/products, which Supabase's own auto-API owns directly (contract §5.2, §5.3, G-10)
- [ ] `src/config/env.ts` — Zod-validated environment schema covering every credential: `AT_API_KEY`, `AT_USERNAME`, `KHAYA_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `MOOLRE_API_USER`, `MOOLRE_API_KEY`, `MOOLRE_VASKEY`, `MOOLRE_PUBKEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `WEBHOOK_SHARED_SECRET`, `LLM_PROVIDER`. No `JWT_SECRET` (we don't sign our own tokens — G-10) and no `REDIS_URL` (dropped — G-11). Boot fails loudly and immediately if any required var is missing.
- [ ] Global error-handling middleware producing RFC 9457 `application/problem+json` per contract §2–§3
- [ ] Request-id middleware (`X-Request-Id`, generated if absent, echoed on every response)
- [ ] Rate-limiter middleware (scopes per contract §2: standard on custom backend endpoints, generous on webhook receivers — no `/v1/auth/login` rate limit needed since that endpoint no longer exists)
- [ ] `idempotency_keys` table + migration, plus middleware (key → response cache, 24h `expiresAt`) reading/writing this table directly via Prisma — no Redis (G-11). Add a scheduled cleanup (`pg_cron` in Supabase, or a simple cron-triggered cleanup endpoint) that deletes expired rows.
- [ ] `GET /v1/health` endpoint
- [ ] `WebhookEvent` model + migration (raw payload logging, with redaction of any token-looking fields before storage) — this and the redaction logic carry over unchanged from any prior Postgres-only bootstrap, since it's DB-shape work, not auth/realtime work

**Acceptance criteria**: server boots and `GET /v1/health` returns `200`; removing any required env var causes a clear startup failure, not a runtime crash; hitting an undefined route returns a well-formed `not-found` problem+json body, never a raw stack trace; Prisma successfully migrates against the Supabase Postgres connection string; an idempotency key round-trips through the Postgres table (write, read-back-on-repeat, conflict-on-mismatch) with no Redis running anywhere.

---

## Phase 1 — Supabase Auth Wiring

**Goal**: a real staff member can log in via Supabase Auth, and every custom backend endpoint can verify that session.

- [ ] Enable email/password auth in the Supabase project's Auth settings
- [ ] `profiles` table + migration (`id` = `auth.users.id`, `role text default 'admin'`), with a Postgres trigger that inserts a `profiles` row whenever a new `auth.users` row is created
- [ ] Frontend: wire `supabase-js`, implement login screen calling `supabase.auth.signInWithPassword()` directly — no custom login endpoint (contract §5.1)
- [ ] Backend: JWT verification middleware validating the Supabase-issued token against `SUPABASE_JWT_SECRET`, then joining `profiles` for role
- [ ] Apply this middleware to every custom `/v1/*` route that requires auth (orders, fulfillments, reconciliation, call-sessions, ussd-sessions)
- [ ] Create the first staff user (via Supabase dashboard or Admin API, not a custom seed script)

**Acceptance criteria**: a staff member can log in from the frontend using Supabase Auth directly; a protected custom backend route rejects a missing/expired/invalid Supabase JWT with `unauthorized`; a valid session's role is correctly read from `profiles`, not guessed or hardcoded.

---

## Phase 2 — Vendor & Product Catalog (Supabase-direct — no custom backend module)

**Goal**: the ~30-item catalog exists and can be managed without any custom backend code for this module.

- [ ] `vendors`, `products` tables + migrations, created directly in Supabase (via Supabase CLI migrations, not Prisma — these tables are outside Prisma's schema per Phase 0)
- [ ] Enable Row Level Security on both tables; write and test the policies from contract §5.2 (staff can read/write, single role in v1)
- [ ] `before delete` trigger on `vendors` blocking hard-delete if the vendor has any `order_items` (forces the frontend to deactivate instead — contract §5.2)
- [ ] Seed script populating the initial ~30 products across a handful of vendors (direct SQL or Supabase Admin API, run once)
- [ ] Minimal admin frontend: Vendor Management page, Product Catalog page, calling Supabase's auto-generated REST API directly via `supabase-js` — no custom API client layer for this module (contract §6)

**Acceptance criteria**: vendors and products can be created, listed, updated, and deactivated from the frontend calling Supabase directly, with zero custom Express code involved; attempting to hard-delete a vendor with existing orders is blocked by the database trigger; an unauthenticated request to the Supabase REST endpoint for either table is rejected by RLS, not by any custom middleware (there is none here).

---

## Phase 3 — Voice Channel: Core Conversational Loop

**Goal**: a real phone call turns into a matched, spoken-back, confirmed order.

- [ ] **Before writing code**: resolve Gap G-6 (confirm Africa's Talking's real-time audio-streaming webhook shape against a live AT account/dashboard) and Gap G-8 (confirm Khaya's raw ASR/TTS request-response JSON against the live developer portal)
- [ ] `CallSession` model + migration
- [ ] `POST /v1/webhooks/voice/inbound` receiver with shared-secret + IP-allowlist verification (Gap G-9)
- [ ] `AsrClient` / `TtsClient` interfaces wrapping the confirmed Khaya shape — no Khaya-specific code outside these two files
- [ ] `LlmClient` interface with two implementations (`ClaudeLlmClient`, `GeminiLlmClient`) selected via `LLM_PROVIDER`, both producing the structured decision shape from contract §7.3
- [ ] `Order`, `OrderItem` models + migrations; order state machine `collecting_items → confirming_order` (contract §9)
- [ ] Abandoned-session sweep background job (Gap G-4): idle sessions past a configurable timeout (default 90s) move to `abandoned`

**Acceptance criteria**: a real test call to the AT number transcribes Twi and English speech, matches spoken items against the seeded catalog, reads back a spoken order summary via TTS, and produces an `Order` row in `confirming_order` state; leaving a call idle past the timeout auto-marks it `abandoned` without manual intervention.

---

## Phase 4 — Payment Collection

**Goal**: confirming an order actually pushes a MoMo prompt and the system knows when it's paid.

- [ ] `Payment` model + migration
- [ ] Moolre `Initiate Payment` integration (contract §7.4), `externalref` derived from the request's `Idempotency-Key`
- [ ] `POST /v1/webhooks/moolre/payment` receiver with shared-secret verification
- [ ] Order transition `awaiting_payment → paid` on webhook success; `→ payment_failed` on failure
- [ ] `POST /v1/orders/{orderId}/retry-payment` (contract §5.4)

**Acceptance criteria**: confirming an order on a real/sandbox call triggers an actual MoMo approval prompt on a test phone; the payment webhook correctly transitions the order to `paid`; `retry-payment` only succeeds from `payment_failed` and returns `invalid-state-transition` otherwise.

---

## Phase 5 — Vendor Notification, Fulfillment & Disbursement

**Goal**: the vendor finds out about the sale, and gets paid once delivery is confirmed.

- [ ] Moolre SMS integration — vendor notification fires on `paid`
- [ ] `VendorFulfillment` model + migration
- [ ] `POST /v1/fulfillments/{id}/mark-delivered` (resolves Gap G-1 — ops confirms delivery since vendors have no app) → triggers Moolre `Initiate Transfer`
- [ ] `Disbursement` model + migration
- [ ] Polling job for transfer status (Gap G-3 — no confirmed Moolre transfer webhook), with backoff
- [ ] `GET /v1/orders/{orderId}/fulfillments` (contract §5.5)

**Acceptance criteria**: a `paid` order sends the vendor a real SMS; marking a fulfillment delivered initiates a real Moolre transfer; the polling job eventually flips `disbursementStatus` to `completed` (or `failed`, surfaced to the dashboard) without manual re-checking.

---

## Phase 6 — Admin Dashboard: Live Monitoring & Reconciliation

**Goal**: the team (and the demo audience) can watch a call become an order in real time, and see the money reconcile.

- [ ] Enable Supabase Realtime (logical replication) on `orders`, `vendor_fulfillments`, `call_sessions` tables
- [ ] RLS policies scoping Realtime subscriptions to authenticated staff (contract §4.1) — Realtime respects the same RLS policies as REST/queries, so this is largely "make sure RLS is already correct," not new policy work
- [ ] `GET /v1/orders`, `GET /v1/orders/{id}`, `GET /v1/call-sessions`, `GET /v1/call-sessions/{id}` (contract §5.4, §5.7) — still custom backend endpoints for initial page load; Realtime only handles the live-update stream after that
- [ ] Live Orders page + Order Detail page, subscribing directly via `supabase-js` Realtime channels — no custom WebSocket client/server code anywhere (contract §4.1, G-10)
- [ ] Live transcript streaming on Order Detail: each new transcript line is a row insert into `call_sessions`' transcript structure, so it arrives as a Realtime `INSERT` event, not a custom event type
- [ ] `GET /v1/reconciliation/summary`, `GET /v1/reconciliation/transactions` (contract §5.6) + Reconciliation page
- [ ] Polling fallback on the dashboard if Realtime disconnects (5s interval against `GET /v1/orders?since=...`, 60s timeout before showing a "live updates paused" banner) — defense-in-depth on top of `supabase-js`'s own reconnect handling

**Acceptance criteria**: placing a real call updates the Live Orders page without a manual refresh, driven entirely by Supabase Realtime with no custom WebSocket server running; briefly killing the network falls back to polling and recovers cleanly on reconnect; reconciliation totals for a test period match Moolre's own transaction history exactly.

---

## Phase 7 — USSD Channel

**Goal**: the same ordering engine works over USSD, for customers who can't or won't do a voice call.

- [ ] **Before writing code**: resolve Gap G-7 (confirm Moolre's USSD inbound session webhook shape against sandbox)
- [ ] `USSDSession` model + migration
- [ ] `POST /v1/webhooks/ussd/inbound` receiver, reusing the `Order`/`OrderItem` engine, catalog matching, and `LlmClient` built in Phase 3 — this phase should add an input/output adapter, not duplicate ordering logic
- [ ] `GET /v1/ussd-sessions`, `GET /v1/ussd-sessions/{id}` (contract §5.7)

**Acceptance criteria**: a full order — item selection through payment through disbursement — can be completed end-to-end via the USSD dial code, sharing the same catalog, payment flow, and fulfillment flow as voice, with no duplicated business logic.

---

## Phase 8 — Hardening

**Goal**: the system survives real-world failure modes, not just the happy path.

- [ ] Audit webhook shared-secret rotation and IP-allowlist coverage for both providers (Gap G-9)
- [ ] Tune retry/backoff for the Moolre transfer-status polling job (Gap G-3)
- [ ] Load-test the idempotency key store and rate limiter under concurrent requests
- [ ] Verify every entry in the contract's Error Catalogue (§3) is actually reachable and returns the exact documented shape
- [ ] Security review: confirm no secrets appear in logs, no stack traces leak to clients, CORS is locked to the dashboard origin only
- [ ] Chaos pass: kill the DB connection mid-request, replay a webhook twice, let a JWT expire mid-session — confirm the system degrades to the contract-documented error responses in every case, never a raw 500 with no problem+json body

**Acceptance criteria**: every chaos scenario above produces a contract-compliant error response, not a crash or an undocumented failure mode.

---

## Database Migration Order

Tables must be created in this order to satisfy foreign key constraints. Note the split: `auth.users`, `profiles`, `vendors`, and `products` are created via **Supabase CLI migrations** (they're either managed by Supabase or owned by RLS-secured direct access); everything else is created via **Prisma migrations** against the same underlying Postgres database.

1. `auth.users` — managed entirely by Supabase, not something we migrate
2. `profiles` (Supabase migration; fk → `auth.users`)
3. `vendors` (Supabase migration)
4. `products` (Supabase migration; fk → `vendors`)
5. `call_sessions` (Prisma migration)
6. `ussd_sessions` (Prisma migration)
7. `orders` (Prisma migration; fk → `call_sessions` nullable, `ussd_sessions` nullable)
8. `order_items` (Prisma migration; fk → `orders`, `products`, `vendors` — Prisma reads/joins `products`/`vendors` but never writes them, per G-10)
9. `vendor_fulfillments` (Prisma migration; fk → `orders`, `vendors`)
10. `payments` (Prisma migration; fk → `orders`)
11. `disbursements` (Prisma migration; fk → `vendor_fulfillments`)
12. `webhook_events` (Prisma migration; standalone, no foreign keys)
13. `idempotency_keys` (Prisma migration; standalone, no foreign keys — replaces the original Redis-based store, G-11)
