# Maame API Build Plan

Sequential phases, each building on the last. No phase starts until the previous phase's acceptance criteria are met. Phases reference `MAAME_API_CONTRACT.md` sections and `MAAME_SPEC.md` gap numbers (G-1 through G-9).

---

## Phase 0 — Project Bootstrap

**Goal**: prove the infrastructure works before any feature code is written.

- [x] Scaffold Node.js + TypeScript repo: `package.json`, `tsconfig.json`, ESLint + Prettier config
- [x] Choose and wire an ORM/migration tool (Prisma or Drizzle) against Postgres
- [x] `src/config/env.ts` — Zod-validated environment schema covering every provider credential: `AT_API_KEY`, `AT_USERNAME`, `KHAYA_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `MOOLRE_API_USER`, `MOOLRE_API_KEY`, `MOOLRE_VASKEY`, `MOOLRE_PUBKEY`, `JWT_SECRET`, `DATABASE_URL`, `WEBHOOK_SHARED_SECRET`, `LLM_PROVIDER`. Boot fails loudly and immediately if any required var is missing.
- [x] Global error-handling middleware producing RFC 9457 `application/problem+json` per contract §2–§3
- [x] Request-id middleware (`X-Request-Id`, generated if absent, echoed on every response)
- [x] Rate-limiter middleware (scopes per contract §2: 5/min login, 60/min webhooks, 120/min authenticated)
- [x] Idempotency-Key middleware skeleton (Redis-backed key→response cache, 24h TTL) — wired to routes in later phases
- [x] `GET /v1/health` endpoint
- [x] `WebhookEvent` model + migration (raw payload logging, with redaction of any token-looking fields before storage)

**Acceptance criteria**: server boots and `GET /v1/health` returns `200`; removing any required env var causes a clear startup failure, not a runtime crash; hitting an undefined route returns a well-formed `not-found` problem+json body, never a raw stack trace.

---

## Phase 1 — Auth & Admin Foundation

**Goal**: a real admin can log in and every subsequent admin endpoint can be protected.

- [ ] `AdminUser` model + migration
- [ ] `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout` (contract §5.1)
- [ ] JWT access-token issuance (15 min expiry) + httpOnly/Secure/SameSite=Strict refresh cookie (7 day, rotates on use, reuse-of-stale-token revokes session)
- [ ] Auth middleware for all `/v1/*` admin routes
- [ ] Seed script creating the first admin user

**Acceptance criteria**: login issues a working access token; a protected route rejects a missing/expired token with `unauthorized`; using an already-rotated refresh token revokes the session rather than silently succeeding.

---

## Phase 2 — Vendor & Product Catalog

**Goal**: the ~30-item catalog exists and can be managed without touching the database directly.

- [ ] `Vendor`, `Product` models + migrations
- [ ] Full CRUD per contract §5.2 (`/v1/vendors`) and §5.3 (`/v1/products`)
- [ ] Idempotency-Key enforcement wired to every mutating endpoint here (first real test of the Phase 0 middleware)
- [ ] Seed script populating the initial ~30 products across a handful of vendors
- [ ] Minimal admin frontend: Vendor Management page, Product Catalog page (contract §6)

**Acceptance criteria**: vendors and products can be created, listed, updated, and deactivated via both the API and the minimal UI; a repeated `Idempotency-Key` with an identical body returns the cached response; the same key with a different body returns `409 idempotency-conflict`.

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

- [ ] WebSocket server (contract §4.1): `orders` and `order:{orderId}` channels
- [ ] `GET /v1/orders`, `GET /v1/orders/{id}`, `GET /v1/call-sessions`, `GET /v1/call-sessions/{id}` (contract §5.4, §5.7)
- [ ] Live Orders page + Order Detail page, including live transcript streaming (`session.transcriptAppended` event)
- [ ] `GET /v1/reconciliation/summary`, `GET /v1/reconciliation/transactions` (contract §5.6) + Reconciliation page
- [ ] Polling fallback on the dashboard if the WebSocket disconnects (5s interval, 60s timeout before showing a "live updates paused" banner)

**Acceptance criteria**: placing a real call updates the Live Orders page without a manual refresh; briefly killing the network falls back to polling and recovers cleanly on reconnect; reconciliation totals for a test period match Moolre's own transaction history exactly.

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

Tables must be created in this order to satisfy foreign key constraints:

1. `admin_users`
2. `vendors`
3. `products` (fk → `vendors`)
4. `call_sessions`
5. `ussd_sessions`
6. `orders` (fk → `call_sessions` nullable, `ussd_sessions` nullable)
7. `order_items` (fk → `orders`, `products`, `vendors`)
8. `vendor_fulfillments` (fk → `orders`, `vendors`)
9. `payments` (fk → `orders`)
10. `disbursements` (fk → `vendor_fulfillments`)
11. `webhook_events` (standalone, no foreign keys)
