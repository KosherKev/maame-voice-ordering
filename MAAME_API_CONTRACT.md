# Maame API Contract

Version 1.0 — source of truth for backend implementation, frontend (admin dashboard) implementation, and any AI agent building against this system.

## 1. Document Governance

This document is the single source of truth for every endpoint, webhook, event, and integration shape in the Maame system. `MAAME_SPEC.md` describes *what* the product does; this contract describes *exactly how* every request and response is shaped.

**No endpoint, field, error type, or event may be added, removed, or changed without updating this document first.** A pull request that changes API behaviour without a corresponding contract change should be rejected in review.

**Breaking changes** (removing a field, changing a field's type, changing a status code, renaming an event) require a version bump (`/v1` → `/v2`) and a deprecation window. **Non-breaking changes** (adding an optional field, adding a new endpoint, adding a new error type) do not require a version bump but still require a contract update first.

## 2. Global Conventions

- **Base URL**: `https://api.maame.app/v1` (placeholder domain — update once provisioned). Versioning is in the URL path.
- **Protocol**: HTTPS only. Any HTTP request is redirected with `301` to the HTTPS equivalent; webhook receivers reject plain HTTP outright.
- **Content types**: All requests and responses use `application/json`, except: (a) error responses, which use `application/problem+json` per RFC 9457, and (b) the two Africa's Talking voice webhook responses, which must return `application/xml` per AT's voice action format (see §7.1 — this is a deliberate, documented exception to the JSON-everywhere rule).
- **Authentication**:
  - Admin dashboard endpoints (`/v1/vendors`, `/v1/products`, `/v1/orders`, `/v1/fulfillments`, `/v1/reconciliation`, `/v1/call-sessions`, `/v1/ussd-sessions`) require a JWT access token in `Authorization: Bearer <token>`.
  - Access tokens expire after 15 minutes. Refresh tokens are issued as httpOnly, Secure, SameSite=Strict cookies, valid 7 days, and rotate on every use (`POST /v1/auth/refresh` issues a new refresh token and invalidates the old one — reuse of an already-rotated refresh token revokes the whole session, standard rotation-detection practice).
  - Webhook receivers (`/v1/webhooks/*`) are not user-authenticated. See §10 for per-provider verification (shared secret / IP allowlist), since neither Africa's Talking nor Moolre's published docs describe a cryptographic webhook signature scheme.
- **Standard request headers**: `Authorization`, `Content-Type: application/json`, `Idempotency-Key` (required on all mutating admin endpoints — see below), `X-Request-Id` (optional, echoed back if provided).
- **Standard response headers**: `X-Request-Id` (generated if not supplied), `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **Error format**: RFC 9457 Problem Details. Every error response has this exact shape:
  ```json
  {
    "type": "https://api.maame.app/problems/validation-error",
    "title": "Validation error",
    "status": 400,
    "detail": "productPriceInPesewas must be a positive integer",
    "instance": "/v1/products",
    "errors": [
      { "detail": "productPriceInPesewas must be a positive integer", "pointer": "/productPriceInPesewas" }
    ]
  }
  ```
  `errors` is present only for validation failures (multiple field errors); omitted otherwise.
- **HTTP status codes in use**: `200` (success), `201` (resource created), `204` (success, no body — e.g. delete), `400` (validation error), `401` (missing/invalid/expired token), `403` (authenticated but not permitted), `404` (resource not found), `409` (conflict — e.g. idempotency key reused with a different request body, or fulfillment already marked delivered), `422` (well-formed but semantically invalid — e.g. marking delivered before payment succeeded), `429` (rate limited), `502` (upstream provider — AT/Khaya/Moolre/LLM — returned an error or timed out), `500` (internal error).
- **Pagination**: All list endpoints use cursor-based pagination. Request: `?limit=20&cursor=<opaque-cursor>`. Response envelope:
  ```json
  {
    "data": [ /* items */ ],
    "pagination": { "nextCursor": "eyJpZCI6MTIzfQ==", "hasMore": true, "limit": 20 }
  }
  ```
  No offset/page-number pagination anywhere in this API.
- **Rate limiting**: Unauthenticated webhook endpoints: 60 req/min per source IP. Authenticated admin endpoints: 120 req/min per user. Login endpoint: 5 req/min per IP (brute-force protection).
- **Idempotency**: All `POST` and `PATCH` requests to admin-facing mutating endpoints require an `Idempotency-Key` header (client-generated UUID v4). The server stores the (key → response) pair for 24 hours; a repeated key with an identical body returns the original cached response with the original status code; a repeated key with a *different* body returns `409 Conflict`. Backed by a fast persistent store (Redis) with a 24h TTL, matching Stripe's pattern. Order-creation and disbursement-triggering endpoints additionally pass this key through as Moolre's `externalref`, so a retried request cannot double-charge or double-pay.
- **File uploads**: Not part of the public API in v1 — call audio is streamed server-side between Africa's Talking and GhanaNLP Khaya and never touches a client-facing upload endpoint. If call-recording storage is added later, it must validate by magic bytes (not `Content-Type`), cap at 10MB, and accept `audio/wav` and `audio/mpeg` only.

## 3. Error Catalogue

| Type URI (suffix under `/problems/`) | Status | Title | When it occurs |
|---|---|---|---|
| `validation-error` | 400 | Validation error | Request body fails schema validation |
| `unauthorized` | 401 | Unauthorized | Missing, malformed, or expired JWT |
| `invalid-credentials` | 401 | Invalid credentials | Login with wrong username/password |
| `forbidden` | 403 | Forbidden | Valid token, insufficient role/permission |
| `not-found` | 404 | Not found | Vendor/product/order/fulfillment/session id doesn't exist |
| `idempotency-conflict` | 409 | Idempotency key conflict | Same `Idempotency-Key` reused with a different request body |
| `fulfillment-already-delivered` | 409 | Fulfillment already delivered | `mark-delivered` called twice for the same fulfillment |
| `invalid-state-transition` | 422 | Invalid state transition | E.g. marking delivered before payment is confirmed; cancelling an already-disbursed order |
| `webhook-signature-invalid` | 401 | Webhook verification failed | Inbound webhook shared-secret/IP check fails (§10) |
| `rate-limited` | 429 | Too many requests | Rate limit exceeded |
| `upstream-provider-error` | 502 | Upstream provider error | Africa's Talking, Khaya, Moolre, or the LLM provider returned an error or timed out |
| `internal-error` | 500 | Internal error | Unhandled server exception |

## 4. Real-Time Events

Two independent real-time surfaces exist. They are not unified because they serve different audiences and different providers.

### 4.1 Admin Dashboard WebSocket (`wss://api.maame.app/v1/ws`)

Authenticated with the same JWT (passed as `?token=` on the upgrade request, since browsers can't set custom headers on WebSocket upgrades). Channel naming: `orders` (all order changes), `order:{orderId}` (one order's detail view). Event envelope:
```json
{ "event": "order.statusChanged", "timestamp": "2026-07-05T14:22:00Z", "data": { "orderId": "ord_123", "previousStatus": "awaiting_payment", "newStatus": "paid" } }
```
Events: `order.statusChanged`, `order.paymentConfirmed`, `order.fulfillmentDelivered`, `order.disbursed`, `session.transcriptAppended` (live transcript line for the Order Detail page during an active call).

**Polling fallback**: if the socket disconnects, the dashboard falls back to `GET /v1/orders?since={lastSeenTimestamp}` every 5 seconds until reconnection, capped at a 60-second timeout before showing a "live updates paused" banner.

### 4.2 Provider Webhooks (inbound to us)

Not WebSocket events — plain HTTP POST webhooks from Africa's Talking, Moolre. Documented as endpoints in §5.5 and integration behaviour in §7.

## 5. Complete Endpoint Reference

### 5.1 Auth

**`POST /v1/auth/login`** — Auth: none. Idempotent: no.
Request: `{ "username": "string", "password": "string" }`
Response `200`: `{ "accessToken": "string", "user": { "id": "string", "username": "string", "role": "admin" } }` (refresh token set as httpOnly cookie)
Errors: `validation-error`, `invalid-credentials`, `rate-limited`

**`POST /v1/auth/refresh`** — Auth: refresh cookie. Idempotent: no.
Response `200`: `{ "accessToken": "string" }` (new refresh cookie set)
Errors: `unauthorized`

**`POST /v1/auth/logout`** — Auth: bearer. Idempotent: yes.
Response `204`
Errors: `unauthorized`

### 5.2 Vendors

**`GET /v1/vendors`** — Auth: bearer. Query: `?limit&cursor&status=active|inactive`
Response `200`: paginated envelope of Vendor objects (§9)

**`POST /v1/vendors`** — Auth: bearer. Idempotency-Key: required.
Request: `{ "name": "string", "phone": "string", "momoChannel": "mtn|telecel|at", "active": true }`
Response `201`: Vendor object
Errors: `validation-error`, `idempotency-conflict`

**`GET /v1/vendors/{vendorId}`** — Auth: bearer. Response `200`: Vendor. Errors: `not-found`

**`PATCH /v1/vendors/{vendorId}`** — Auth: bearer. Idempotency-Key: required.
Request: any subset of `{ "name", "phone", "momoChannel", "active" }`
Response `200`: Vendor. Errors: `validation-error`, `not-found`, `idempotency-conflict`

**`DELETE /v1/vendors/{vendorId}`** — Auth: bearer. Response `204` (soft delete — sets `active: false`, never hard-deletes a vendor with order history). Errors: `not-found`

### 5.3 Products

**`GET /v1/products`** — Auth: bearer. Query: `?limit&cursor&vendorId&inStock=true|false&search=string`
Response `200`: paginated Product objects

**`POST /v1/products`** — Auth: bearer. Idempotency-Key: required.
Request: `{ "name": "string", "priceInPesewas": integer, "vendorId": "string", "category": "string", "inStock": true }`
Response `201`: Product. Errors: `validation-error`, `not-found` (bad vendorId), `idempotency-conflict`

**`GET /v1/products/{productId}`** — Response `200`: Product. Errors: `not-found`

**`PATCH /v1/products/{productId}`** — Auth: bearer. Idempotency-Key: required.
Request: any subset of `{ "name", "priceInPesewas", "category", "inStock" }`
Response `200`: Product. Errors: `validation-error`, `not-found`, `idempotency-conflict`

**`DELETE /v1/products/{productId}`** — Response `204`. Errors: `not-found`

### 5.4 Orders

**`GET /v1/orders`** — Auth: bearer. Query: `?limit&cursor&status&channel=voice|ussd&since=ISO8601`
Response `200`: paginated Order objects (summary shape — full detail via single-resource route)

**`GET /v1/orders/{orderId}`** — Auth: bearer. Response `200`: Order object including nested `orderItems[]`, `fulfillments[]`, `payment`, and (for voice orders) a link to the call transcript. Errors: `not-found`

**`POST /v1/orders/{orderId}/retry-payment`** — Auth: bearer. Idempotency-Key: required.
Re-triggers the Moolre `Initiate Payment` call for an order stuck in `payment_failed`. Response `200`: Order. Errors: `not-found`, `invalid-state-transition` (order not in `payment_failed`)

**`POST /v1/orders/{orderId}/cancel`** — Auth: bearer. Idempotency-Key: required.
Response `200`: Order (status → `cancelled`). Errors: `not-found`, `invalid-state-transition` (cannot cancel an already-`disbursed` order)

### 5.5 Fulfillments

**`GET /v1/orders/{orderId}/fulfillments`** — Auth: bearer. Response `200`: array of VendorFulfillment objects (always length 1 in v1's single-vendor matching logic; schema supports more — see spec G-2).

**`POST /v1/fulfillments/{fulfillmentId}/mark-delivered`** — Auth: bearer. Idempotency-Key: required.
This is the action that resolves spec Gap G-1 (no vendor app — an ops staffer confirms delivery) and triggers the Moolre `Initiate Transfer` disbursement call.
Response `200`: VendorFulfillment object (status → `delivered`, disbursement initiated asynchronously — poll `disbursementStatus` field or subscribe to `order.disbursed`).
Errors: `not-found`, `fulfillment-already-delivered`, `invalid-state-transition` (order not yet `paid`)

### 5.6 Reconciliation

**`GET /v1/reconciliation/summary`** — Auth: bearer. Query: `?startDate&endDate`
Response `200`: `{ "totalCollectedInPesewas": integer, "totalDisbursedInPesewas": integer, "totalMoolreFeesInPesewas": integer, "totalServiceFeeRevenueInPesewas": integer, "outstandingUnsettledInPesewas": integer }`

**`GET /v1/reconciliation/transactions`** — Auth: bearer. Query: `?limit&cursor&type=collection|disbursement&startDate&endDate`
Response `200`: paginated ledger entries, each `{ "type": "collection|disbursement", "orderId", "amountInPesewas", "moolreFeeInPesewas", "moolreTransactionId", "status", "timestamp" }`

### 5.7 Call & USSD Sessions (read-only, QA/debugging)

**`GET /v1/call-sessions`** — Auth: bearer. Query: `?limit&cursor&phone&since`
Response `200`: paginated CallSession summaries

**`GET /v1/call-sessions/{callSessionId}`** — Response `200`: CallSession including full transcript array `[{ "speaker": "customer|maame", "text": "string", "timestamp": "ISO8601" }]`. Errors: `not-found`

**`GET /v1/ussd-sessions/{ussdSessionId}`** — Response `200`: USSDSession including menu-state history. Errors: `not-found`

### 5.8 Provider Webhooks (inbound)

**`POST /v1/webhooks/voice/inbound`** — Auth: shared secret query param `?key=` + Africa's Talking source-IP allowlist (§10). Not idempotent in the usual sense — every call event must be processed. Request body: form-encoded per AT (`callerNumber`, `callSessionState`, `isActive`, `sessionId`, plus `dtmfDigits`/`recordingUrl` depending on stage — confirm exact field list against the live AT dashboard before build, since their docs page is JS-rendered and couldn't be fully captured here). **Response is XML, not JSON** — one of AT's voice actions (`Say`, `GetDigits`, `Record`, `Play`, `Redirect`), e.g.:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman" playBeep="false">Ɛte sɛn! What do you need today?</Say>
  <GetDigits timeout="15" finishOnKey="#" callbackUrl="https://api.maame.app/v1/webhooks/voice/inbound"/>
</Response>
```
(In practice `GetDigits` is DTMF-oriented; the actual conversational loop uses AT's recording/streaming mechanism feeding Khaya ASR — confirm AT's exact real-time audio streaming action name against their current docs before implementation, flagged in §8 as Gap G-6.)

**`POST /v1/webhooks/ussd/inbound`** — Auth: shared secret + Moolre source-IP allowlist. Request/response follow Moolre's USSD session protocol (`*203#` style, `sessionid` correlates turns) — exact field-level shape to be confirmed against Moolre's USSD integration docs at build time (their public reference is minimal on this endpoint; treat as Gap G-7 in §8).

**`POST /v1/webhooks/moolre/payment`** — Auth: shared secret (Moolre's docs don't specify a signature scheme; see §10). Request body per Moolre's Payment Webhook spec: `{ "status": 1, "code": "P01", "message": "Transaction Successful", "data": { /* transaction details incl. externalref, transactionid, amount */ } }`. Response `200` with empty body acknowledges receipt (Moolre retries on non-200). This webhook transitions the matching Order from `awaiting_payment` to `paid`.

## 6. Page → Route Index

| Page | Endpoints called, in order |
|---|---|
| Login | `POST /v1/auth/login` |
| Live Orders | `GET /v1/orders?status=...` (initial load) → WebSocket subscribe to `orders` channel |
| Order Detail | `GET /v1/orders/{orderId}` → `GET /v1/call-sessions/{id}` (if voice) or `GET /v1/ussd-sessions/{id}` (if ussd) → WebSocket subscribe to `order:{orderId}` |
| Vendor Management | `GET /v1/vendors` → `POST /v1/vendors` / `PATCH /v1/vendors/{id}` / `DELETE /v1/vendors/{id}` |
| Product Catalog | `GET /v1/products` → `POST /v1/products` / `PATCH /v1/products/{id}` / `DELETE /v1/products/{id}` |
| Fulfillment | `GET /v1/orders/{orderId}/fulfillments` → `POST /v1/fulfillments/{id}/mark-delivered` |
| Reconciliation | `GET /v1/reconciliation/summary` → `GET /v1/reconciliation/transactions` |

## 7. Third-Party Integration Notes

### 7.1 Africa's Talking Voice API

- Base: developer console-issued number; webhook configured to `POST /v1/webhooks/voice/inbound`.
- Auth: API key + username sent by *us* when we make outbound calls (not used for inbound — inbound calls are verified via shared secret + IP allowlist, §10).
- Confirmed pricing: incoming calls GHS 0.009/min; virtual number GHS 300+VAT/month rental, GHS 500+VAT one-off setup (source: Africa's Talking Ghana pricing page).
- Confirmed request params on inbound webhook: `callerNumber`, `callSessionState`, `isActive`, `sessionId`. Confirmed response actions: `Say`, `GetDigits`, `Record`, `Play`, wrapped in `<Response>` XML.
- **Not confirmed / needs verification against the live dashboard before build**: the exact action/parameter set for real-time audio streaming to an external ASR (vs. simple DTMF `GetDigits`), and whether recording callbacks deliver a downloadable URL or a stream. This is Gap G-6 (§8).

### 7.2 GhanaNLP Khaya API (ASR + TTS)

- Base: `https://translation.ghananlp.org` (confirmed from their developer portal and Python SDK).
- Auth: API key issued on signup.
- Plan: Standard tier, $89.95/month, 20,000 requests/month, one request = one call regardless of audio duration (confirmed directly with GhanaNLP).
- Conceptual shape (from the official Python library): STT takes an audio file + language code (e.g. `"tw"` for Twi) and returns transcribed text; TTS takes text + language code and returns audio binary; Translation takes text + a language pair (e.g. `"en-tw"`).
- **Not confirmed**: the exact raw HTTP request/response JSON shape (their browser-rendered docs at `/api-docs` couldn't be captured via automated fetch). Confirm exact field names against the live developer portal before implementation — this is Gap G-8 (§8). Do not guess field names; the contract will be updated once confirmed.

### 7.3 LLM Provider (Claude Haiku 4.5 / Gemini 2.5 Flash-Lite)

Not a public endpoint — called internally by the voice/USSD webhook handler behind a single `LlmClient` interface (spec G-5). Both providers must be driven to produce the same internal structured decision shape:
```json
{
  "intent": "add_item | remove_item | ask_clarification | confirm_order | cancel",
  "matchedItems": [ { "productId": "string", "quantity": integer, "confidence": 0.0 } ],
  "clarifyingQuestion": "string | null",
  "orderSummaryText": "string | null"
}
```
Provider selected via `LLM_PROVIDER` env var (`claude` | `gemini`). Claude via Anthropic API (`model: claude-haiku-4-5`), Gemini via Google AI Studio API (`model: gemini-2.5-flash-lite`). Both called with the same system prompt (catalog + conversation state) and required to return the same JSON schema — implemented via each provider's structured-output/tool-calling feature, not free-text parsing.

### 7.4 Moolre (SMS, USSD, Collections, Transfer)

Base: `https://api.moolre.com` (sandbox: `https://sandbox.moolre.com`). Auth: `X-API-USER` + `X-API-KEY` (+ `X-API-VASKEY` for SMS, `X-API-PUBKEY` for payment-link/account-creation endpoints); not required in sandbox except `X-API-USER`.

- **SMS** (`POST /open/sms/send`): used for vendor order notifications. Confirmed GHS 0.0222/message (200 GHS / 9,000-message bundle).
- **USSD**: shared shortcode, GHS 420/month + GHS 0.014/session (confirmed pricing). Exact inbound session webhook shape is Gap G-7 (§8).
- **Collections** (`POST /open/transact/payment`, "Initiate Payment"): pushes the USSD MoMo approval prompt to the customer's phone mid-call. `channel` 13=MTN, 6=Telecel, 7=AT. Requires unique `externalref` (mapped from our `Idempotency-Key`). Confirmed fee: Moolre 1% (min GHS 0.50, cap GHS 10) + network fee 0.5–1% (cap GHS 20).
- **Transfer** (`POST /open/transact/transfer`, "Initiate Transfer"): disburses to the vendor's MoMo wallet on `mark-delivered`. `channel` 1=MTN, 6=Telecel, 7=AT. Confirmed fee: Moolre 1% (min GHS 0.50, cap GHS 10), 0% network fee. **No documented push webhook for transfer completion** — the backend polls `POST /open/transact/status` (`idtype=1`, `id=externalref`) on a backoff schedule (Gap G-3, carried from spec).
- **Validate Name** (`POST /open/transact/validate`): called before the first disbursement to a new vendor's MoMo number, to catch typos before money moves.
- Webhook signature: Moolre's public reference does not document a cryptographic signature for the payment webhook — see §10 for the shared-secret mitigation.

## 8. Logic Gap Analysis and Resolutions

Carried forward from `MAAME_SPEC.md` §8 (G-1 through G-5), plus gaps found while writing this contract:

- **G-1** (spec): No vendor app → ops manually marks delivery via `POST /v1/fulfillments/{id}/mark-delivered`, which is the sole trigger for disbursement. **Contract impact**: this endpoint carries real financial weight and must be restricted to authenticated admin roles only, logged in the reconciliation ledger with the acting user's id.
- **G-2** (spec): Multi-vendor-ready schema, single-vendor matching logic in v1. **Contract impact**: `GET /v1/orders/{orderId}/fulfillments` always returns array length 1 today but the response shape is already an array, so no future breaking change is needed when matching logic splits baskets.
- **G-3** (spec): No confirmed Moolre transfer webhook → poll `transact/status`. **Contract impact**: `VendorFulfillment.disbursementStatus` is an eventually-consistent field; the dashboard must show a "processing" state, not assume synchronous completion.
- **G-4** (spec): Abandoned calls/sessions timeout to `abandoned` status. **Contract impact**: `CallSession.status` and `USSDSession.status` both include `abandoned` as a valid terminal value; a background job (not a public endpoint) sweeps idle sessions past a configurable timeout (default 90 seconds of no input).
- **G-5** (spec): LLM provider swappable via `LlmClient` interface. **Contract impact**: no public endpoint exposes provider choice; it's an internal/ops config concern, not part of the versioned API surface.
- **G-6** (new): Africa's Talking's exact real-time audio-streaming webhook shape (vs. simple DTMF) isn't confirmed from public docs (JS-rendered pages blocked automated fetch). **Resolution**: confirm against the live AT dashboard/account before Phase 3 (voice channel) implementation begins; do not hardcode assumed field names into the ASR pipeline until verified.
- **G-7** (new): Moolre's USSD inbound webhook shape isn't fully documented publicly beyond the `*203#` dial-code convention. **Resolution**: confirm with Moolre support/sandbox before Phase 7 (USSD channel) implementation.
- **G-8** (new): Khaya's exact raw HTTP request/response JSON (vs. the Python SDK's abstracted method signatures) isn't confirmed. **Resolution**: confirm against the Khaya developer portal (requires signup) before Phase 3 implementation; the internal `AsrClient`/`TtsClient` interfaces should wrap whatever the real shape turns out to be, so the rest of the codebase never depends on Khaya's wire format directly.
- **G-9** (new): Neither Africa's Talking nor Moolre document cryptographic webhook signatures. **Resolution**: see §10 — shared secret in the callback URL query string plus source-IP allowlisting, with a migration path to signature verification if either provider adds it later.

## 9. Data Models Reference

All monetary fields are integers in pesewas (1 GHS = 100 pesewas). All timestamps are ISO 8601 UTC. All response field names are camelCase. Internal-only fields (never returned in API responses) are marked accordingly.

**Vendor**: `id`, `name`, `phone`, `momoChannel` (`mtn|telecel|at`), `active`, `createdAt`, `updatedAt`. *Internal only*: none.

**Product**: `id`, `name`, `priceInPesewas`, `vendorId`, `category`, `inStock`, `createdAt`, `updatedAt`.

**Order**: `id`, `customerPhone`, `channel` (`voice|ussd`), `status` (`collecting_items|confirming_order|awaiting_payment|paid|vendor_notified|out_for_delivery|delivered|disbursed|payment_failed|cancelled|abandoned`), `totalInPesewas`, `serviceFeeInPesewas`, `orderItems[]`, `createdAt`, `updatedAt`. *Internal only*: `llmProviderUsed` (debugging field, excluded from response by default, included only for admin/debug role).

**OrderItem**: `id`, `orderId`, `productId`, `vendorId`, `quantity`, `unitPriceInPesewas`.

**VendorFulfillment**: `id`, `orderId`, `vendorId`, `subtotalInPesewas`, `deliveryStatus` (`pending|delivered`), `disbursementStatus` (`not_started|processing|completed|failed`), `disbursementReference`, `createdAt`, `updatedAt`.

**Payment**: `id`, `orderId`, `moolreTransactionId`, `amountInPesewas`, `moolreFeeInPesewas`, `status` (`pending|success|failed`), `createdAt`. *Internal only*: `externalref` (Moolre correlation id, used for polling, not customer-facing).

**Disbursement**: `id`, `vendorFulfillmentId`, `moolreTransactionId`, `amountInPesewas`, `moolreFeeInPesewas`, `status` (`pending|success|failed`), `createdAt`. *Internal only*: `externalref`.

**CallSession**: `id`, `customerPhone`, `status` (`active|completed|abandoned`), `orderId` (nullable until an order is created), `transcript[]` (`{speaker, text, timestamp}`), `createdAt`, `endedAt`.

**USSDSession**: `id`, `customerPhone`, `sessionIdMoolre` (internal correlation id — *internal only*, never returned), `status` (`active|completed|abandoned`), `orderId`, `menuState`, `createdAt`, `endedAt`.

**AdminUser**: `id`, `username`, `role` (`admin`), `createdAt`. *Internal only*: `passwordHash` (never in any response, ever).

**WebhookEvent**: `id`, `source` (`africas_talking|moolre`), `rawPayload` (stored for audit/replay — *internal only*, never exposed via public API; accessible only through direct DB access for engineering debugging), `receivedAt`.

## 10. Security Baseline

- **JWT handling**: access tokens 15-min expiry, signed with a rotated secret (stored in a secrets manager, never in code or `.env` committed to git). Refresh tokens httpOnly + Secure + SameSite=Strict cookies, rotate on every use, reuse-of-stale-token revokes the session.
- **Webhook verification**: since neither Africa's Talking nor Moolre document a cryptographic signature scheme, both inbound webhook endpoints require (a) a long random shared secret passed as a query parameter on the registered callback URL (not guessable, rotated if ever leaked in logs), and (b) a source-IP allowlist of each provider's published outbound IP ranges. This is a documented compensating control, not a substitute for real signature verification if either provider adds it later — revisit as Gap G-9 is resolved.
- **Secrets storage**: all API keys (Africa's Talking, Khaya, Anthropic, Google, Moolre) live in environment variables injected at deploy time, never committed to the repository, never logged in plaintext (webhook payloads containing tokens must be redacted before writing to `WebhookEvent.rawPayload`).
- **File validation**: not applicable in v1 (no public file upload endpoint — see §2).
- **CORS policy**: admin dashboard origin only, explicit allowlist, no wildcard `*`.
- **Rate limit scope**: per §2 — stricter on `/v1/auth/login`, standard elsewhere, generous but present on webhook receivers.
- **Error response sanitisation**: `500 internal-error` responses never leak stack traces, database error messages, or upstream provider raw error bodies to the client — those are logged server-side only, with `instance` set to a request id the engineer can grep for.

## 11. References

- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Stripe — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)
- [Africa's Talking — Voice API docs](https://developers.africastalking.com/docs/voice/handle_calls)
- [Africa's Talking — Ghana pricing page](https://africastalking.com/pricing)
- [GhanaNLP Khaya — developer portal](https://translation.ghananlp.org/)
- [Ghana NLP Python Library](https://pypi.org/project/ghana-nlp/)
- [Moolre — full API reference](https://docs.moolre.com/llms-full.txt)
- [Moolre — pricing](https://moolre.com/pricing)
- [Anthropic — Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Google — Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
