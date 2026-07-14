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
- **Authentication (Supabase Auth — G-10)**:
  - Staff login/logout/session-refresh is handled entirely by **Supabase Auth**, called directly from the frontend via `supabase-js` (`supabase.auth.signInWithPassword`, automatic session refresh). There are no custom `/v1/auth/*` endpoints in this API — see G-10 in §8.
  - Custom backend endpoints (`/v1/orders`, `/v1/fulfillments`, `/v1/reconciliation`, `/v1/call-sessions`, `/v1/ussd-sessions`) require the Supabase-issued JWT in `Authorization: Bearer <token>`. The backend verifies it against the Supabase project's JWT secret (`SUPABASE_JWT_SECRET`) — it never signs its own tokens.
  - Staff role is read from a `profiles` table (`id` = `auth.users.id`, `role` column), joined at request time by the auth middleware, not encoded in the JWT itself (keeps role changes effective immediately, no token refresh required).
  - Vendors and Products have **no custom backend endpoints at all** — the frontend calls Supabase's auto-generated REST API for these directly, secured by Row Level Security (RLS) policies scoped to authenticated staff. See §5.2/§5.3.
  - Webhook receivers (`/v1/webhooks/*`) are not Supabase-authenticated — they're external providers (Africa's Talking, Moolre), not staff. See §10 for per-provider verification (shared secret / IP allowlist).
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
- **Idempotency**: All `POST` and `PATCH` requests to admin-facing mutating endpoints require an `Idempotency-Key` header (client-generated UUID v4). The server stores the (key → response) pair for 24 hours; a repeated key with an identical body returns the original cached response with the original status code; a repeated key with a *different* body returns `409 Conflict`. Backed by an `idempotency_keys` table in the same Supabase Postgres database (key, response body, status code, `expires_at`), with a scheduled cleanup job (`pg_cron` or an external cron hitting a cleanup endpoint) removing expired rows — no separate Redis instance required (G-11, §8). Order-creation and disbursement-triggering endpoints additionally pass this key through as Moolre's `externalref`, so a retried request cannot double-charge or double-pay.
- **File uploads**: Not part of the public API in v1 — call audio is streamed server-side between Africa's Talking and GhanaNLP Khaya and never touches a client-facing upload endpoint. If call-recording storage is added later, it must validate by magic bytes (not `Content-Type`), cap at 10MB, and accept `audio/wav` and `audio/mpeg` only.

## 3. Error Catalogue

| Type URI (suffix under `/problems/`) | Status | Title | When it occurs |
|---|---|---|---|
| `validation-error` | 400 | Validation error | Request body fails schema validation |
| `unauthorized` | 401 | Unauthorized | Missing, malformed, or expired JWT |
| `invalid-credentials` | 401 | Invalid credentials | Login with wrong username/password (Note: Supabase Auth is called direct from frontend per G-10; this error is currently unused/unreachable in the custom API endpoints) |
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

### 4.1 Admin Dashboard Realtime (Supabase Realtime — G-10)

There is no custom WebSocket server in this system. The admin dashboard subscribes **directly to Postgres table changes** using `supabase-js`'s Realtime client, authenticated with the same Supabase session used for Auth. This is Postgres logical-replication-based change data capture, not an application-level event bus — the backend does not "emit" anything; it simply writes to the database and Supabase pushes the change.

Tables with Realtime enabled and their RLS-scoped subscriptions:
- `orders` — dashboard subscribes to all rows (staff role) for the Live Orders board; filters client-side by status/channel
- `orders:id=eq.{orderId}` — Order Detail page subscribes to one row
- `vendor_fulfillments:order_id=eq.{orderId}` — Order Detail page, fulfillment status
- `call_sessions:id=eq.{callSessionId}` — Order Detail page, live transcript (each new transcript line is a row insert, not an update, so it streams naturally via Realtime's `INSERT` event)

The client library (`supabase-js`) handles reconnection and backoff internally. As a defense-in-depth fallback if Realtime is unreachable (e.g. corporate network blocking WebSockets), the dashboard falls back to polling `GET /v1/orders?since={lastSeenTimestamp}` (custom backend endpoint, §5.4) every 5 seconds, capped at a 60-second timeout before showing a "live updates paused" banner.

### 4.2 Provider Webhooks (inbound to us)

Plain HTTP POST webhooks from Africa's Talking and Moolre — unrelated to Supabase Realtime, since these are external providers, not our own database changes. Documented as endpoints in §5.8 and integration behaviour in §7.

## 5. Complete Endpoint Reference

### 5.1 Auth

**No custom endpoints.** Staff authentication is handled entirely by Supabase Auth, called directly from the frontend via `supabase-js` (G-10, §8):
- Login: `supabase.auth.signInWithPassword({ email, password })`
- Session refresh: handled automatically by the client SDK
- Logout: `supabase.auth.signOut()`

The custom backend never issues or signs a token — it only verifies the Supabase-issued JWT on protected routes (§2).

### 5.2 Vendors — Supabase-direct, RLS-secured (no custom endpoints)

The frontend calls Supabase's auto-generated REST API directly: `GET/POST/PATCH/DELETE https://{project}.supabase.co/rest/v1/vendors`. No custom Express controller exists for this resource (G-10, §8). Security is enforced by Row Level Security policies, not application code:

```sql
-- Read: any authenticated staff member
create policy "staff can read vendors" on vendors for select
  using (auth.role() = 'authenticated');
-- Write: any authenticated staff member (single staff role in v1 — see spec, no tiered permissions yet)
create policy "staff can write vendors" on vendors for insert, update, delete
  using (auth.role() = 'authenticated');
```

Table shape matches the Vendor data model in §9. Soft-delete convention (`active: false`, never hard-delete a vendor with order history) is enforced by a `before delete` Postgres trigger that raises an exception if the vendor has any `order_items`, forcing the frontend to deactivate instead.

### 5.3 Products — Supabase-direct, RLS-secured (no custom endpoints)

Same pattern as §5.2: `GET/POST/PATCH/DELETE https://{project}.supabase.co/rest/v1/products`, RLS-scoped to authenticated staff. Table shape matches §9. The custom backend *reads* this table (via Prisma, read-only) when matching catalog items during a call — it never writes to it.

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

**`GET /v1/ussd-sessions`** — Auth: bearer. Query: `?limit&cursor&phone&since`
Response `200`: paginated USSDSession summaries

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

**`POST /v1/webhooks/ussd/inbound`** — Auth: shared secret + Moolre source-IP allowlist. Moolre POSTs this JSON on every USSD turn:

```json
{
  "sessionId": "3-17074657982460137",
  "new": true,
  "msisdn": "233241235993",
  "network": 3,
  "message": "",
  "extension": "109",
  "data": "11005"
}
```

| Field | Type | Description |
|---|---|---|
| `sessionId` | string | Unique session ID — correlates all turns of one dial |
| `new` | boolean | `true` on the first turn of a session |
| `msisdn` | string | Customer's phone number |
| `network` | integer | 3 = MTN, 5 = AirtelTigo, 6 = Telecel |
| `message` | string | Customer's input text (empty string on the first turn) |
| `extension` | string | The shared-code extension Maame was assigned (e.g. `"109"` → `*203*109#`) |
| `data` | string | Extra digits dialled at initiation (e.g. `*203*109*11005#` → `"11005"`) |

Response **must** be `application/json`:
```json
{ "message": "Welcome to Maame!\n1) Order groceries\n2) Check order status", "reply": true }
```
`reply: true` keeps the session open (another input expected); `reply: false` terminates the session. Response must be returned within Moolre's session timeout — design the first menu turn to be stateless enough to respond < 2 seconds. Gap G-7 resolved (confirmed from Moolre's live simulator and docs — §8).

**Dev note**: Moolre's browser-based USSD simulator POSTs directly to your callback URL from the browser, so during local development your server must respond with `Access-Control-Allow-Origin: *` (or use a tunnelling tool like ngrok that handles CORS for you). This is a dev-only concern — in production, standard CORS settings apply.

**`POST /v1/webhooks/moolre/payment`** — Auth: shared secret (Moolre's docs don't specify a signature scheme; see §10). Request body per Moolre's Payment Webhook spec: `{ "status": 1, "code": "P01", "message": "Transaction Successful", "data": { /* transaction details incl. externalref, transactionid, amount */ } }`. Response `200` with empty body acknowledges receipt (Moolre retries on non-200). This webhook transitions the matching Order from `awaiting_payment` to `paid`.

## 6. Page → Route Index

| Page | Calls, in order |
|---|---|
| Login | Supabase Auth directly: `supabase.auth.signInWithPassword()` — no custom endpoint |
| Live Orders | `GET /v1/orders?status=...` (initial load) → Supabase Realtime subscribe to `orders` table |
| Order Detail | `GET /v1/orders/{orderId}` → `GET /v1/call-sessions/{id}` (if voice) or `GET /v1/ussd-sessions/{id}` (if ussd) → Supabase Realtime subscribe to `orders:id=eq.{orderId}`, `vendor_fulfillments:order_id=eq.{orderId}`, and (if voice) `call_sessions:id=eq.{callSessionId}` |
| Vendor Management | Supabase REST directly: `GET/POST/PATCH/DELETE .../rest/v1/vendors` — no custom endpoint |
| Product Catalog | Supabase REST directly: `GET/POST/PATCH/DELETE .../rest/v1/products` — no custom endpoint |
| Fulfillment | `GET /v1/orders/{orderId}/fulfillments` → `POST /v1/fulfillments/{id}/mark-delivered` |
| Reconciliation | `GET /v1/reconciliation/summary` → `GET /v1/reconciliation/transactions` |

## 7. Third-Party Integration Notes

### 7.0 Supabase (Auth, Realtime, Postgres, Storage of RLS-secured tables)

- Not a third-party integration in the same sense as AT/Khaya/Moolre — Supabase *is* our database and auth provider, not an external service we call for a discrete feature. Documented here because it's still an external hosted dependency the rest of the system relies on.
- **Auth**: staff accounts live in Supabase's managed `auth.users` table; we extend it with a `public.profiles` table (`id` = `auth.users.id`, `role text`) for anything role-specific. Frontend never talks to our backend for login — only to Supabase directly.
- **Realtime**: Postgres logical replication, exposed via `supabase-js` channels, RLS-scoped. No custom WebSocket server to run or maintain.
- **Database**: hosted Postgres. Prisma (backend) and Supabase's PostgREST auto-API (frontend, for vendors/products) both point at the *same* underlying database — there is one source of truth, accessed two ways depending on which layer owns the logic.
- **Auth method for backend verification**: the custom Express backend verifies inbound JWTs using the Supabase project's JWT secret (`SUPABASE_JWT_SECRET`, HS256) or JWKS endpoint if the project uses RS256 — confirm which your Supabase project is configured for before Phase 1.
- **Service role key**: `SUPABASE_SERVICE_ROLE_KEY` is used server-side only (Prisma connection, and any backend operation that must bypass RLS, e.g. writing an Order on behalf of a phone-based customer who has no Supabase Auth session at all — customers never authenticate with Supabase, only staff do). Never expose the service role key to the frontend.

### 7.1 Africa's Talking Voice API

- Base: developer console-issued number; webhook configured to `POST /v1/webhooks/voice/inbound`.
- Auth: API key + username sent by *us* when we make outbound calls (not used for inbound — inbound calls are verified via shared secret + IP allowlist, §10).
- Confirmed pricing: incoming calls GHS 0.009/min; virtual number GHS 300+VAT/month rental, GHS 500+VAT one-off setup (source: Africa's Talking Ghana pricing page).
- Confirmed request params on inbound webhook: `callerNumber`, `callSessionState`, `isActive`, `sessionId`. Confirmed response actions: `Say`, `GetDigits`, `Record`, `Play`, wrapped in `<Response>` XML.
- **Not confirmed / needs verification against the live dashboard before build**: the exact action/parameter set for real-time audio streaming to an external ASR (vs. simple DTMF `GetDigits`), and whether recording callbacks deliver a downloadable URL or a stream. This is Gap G-6 (§8).

### 7.2 GhanaNLP Khaya API (ASR + TTS)

- Developer portal: `https://translation.ghananlp.org` (Azure API Management). Auth header: `Ocp-Apim-Subscription-Key: <key>`.
- Plan: Standard tier, $89.95/month, 20,000 requests/month, one request = one call regardless of audio duration (confirmed directly with GhanaNLP).

#### ASR v3 — ✅ G-8 Resolved (confirmed from live portal, 2026-07-14)

- **GET** `https://translation-api.ghananlp.org/asr/v3/languages` — returns `{ languages: [{ code: string, name: string }] }`. Language codes are ISO 639-3 (e.g. `"twi"` for Twi, `"ewe"` for Ewe).
- **POST** `https://translation-api.ghananlp.org/asr/v3/transcribe?language={code}[&timestamps=word|segment]`
  - **Request body**: raw audio bytes (not multipart/form-data). `Content-Type` must be one of `audio/mpeg`, `audio/wav`, `audio/flac`, `audio/ogg`.
  - **language** is a **URL template/query parameter**, not a form field.
  - **Response 200**: `{ "text": "transcribed text" }` (with optional `timings` object when `timestamps` param is set).
  - **Response 400**: `{ error: { code: "VALIDATION_FAILED", message: string, details: [{ code: "EMPTY_AUDIO" | "UNSUPPORTED_LANGUAGE" | "INVALID_AUDIO_FORMAT" | "INVALID_TIMESTAMPS" | "UNSUPPORTED_TIMESTAMPS", target: string, message: string }] } }`
  - **Response 500**: `{ error: { code: "SYSTEM_ERROR", message: string, details: [] } }`

#### TTS v2 — ✅ G-8 Resolved (confirmed from live portal, 2026-07-14)

- **GET** `https://translation-api.ghananlp.org/tts/v2/speakers` — returns available speaker IDs (e.g. `male_low`, `male_high`, `female`).
- **GET** `https://translation-api.ghananlp.org/tts/v2/languages` — returns supported language codes (e.g. `"twi"`).
- **POST** `https://translation-api.ghananlp.org/tts/v2/synthesize`
  - **Request body (JSON)**: `{ "text": string, "language": string, "speaker_id"?: string, "stream"?: boolean, "format"?: "wav" | "mp3" | "ogg" }`
  - **Response 200**: Raw audio bytes matching the requested `format`.
  - **Response 400**: `{ error: { code: "VALIDATION_FAILED", message: string, details: [{ code: "EMPTY_TEXT" | "MISSING_LANGUAGE" | "UNSUPPORTED_LANGUAGE" | "INVALID_SPEAKER" | "INVALID_REQUEST", target: string, message: string }] } }`
  - **Response 500**: `{ error: { code: "SYSTEM_ERROR", message: string, details: [] } }`

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
- **USSD**: shared shortcode on `*203#` (e.g. `*203*109#`), GHS 420/month + GHS 0.014/session (confirmed pricing). Dedicated shortcodes also available with NCA approval. Inbound webhook shape confirmed — see §5.8 (G-7 resolved). Testing: use Moolre's in-dashboard browser simulator (configure callback URL + extension, dial the simulated code, your server handles each turn in real time).
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
- **G-7** ✅ **Resolved**: Moolre does offer full USSD application hosting (shared code `*203*{ext}#` or dedicated shortcode). Inbound webhook shape confirmed from the live Moolre dashboard simulator and docs — see §5.8 for the exact payload. Moolre's simulator POSTs the same JSON payload to your callback URL that production does, allowing end-to-end local testing without a real handset. Network codes: 3=MTN, 5=AirtelTigo, 6=Telecel. Dev CORS note documented in §5.8.
- **G-8** ✅ **Resolved**: Khaya's ASR v3 and TTS v2 wire formats were confirmed from the live developer portal (2026-07-14) — see §7.2. The internal `AsrClient`/`TtsClient` interfaces were updated to match the real shape, insulating the rest of the codebase from the wire format.
- **G-9** (new): Neither Africa's Talking nor Moolre document cryptographic webhook signatures. **Resolution**: see §10 — shared secret in the callback URL query string plus source-IP allowlisting, with a migration path to signature verification if either provider adds it later.
- **G-10** (new — architecture decision, replaces the original Postgres/Prisma-only/custom-JWT/custom-WebSocket design): the system moved to Supabase for Auth, Realtime, and (for Vendors/Products only) direct database access via RLS instead of custom endpoints. **Resolution**: custom `/v1/auth/*` endpoints removed entirely (§5.1); Vendors and Products CRUD removed from the custom backend and replaced with RLS policies (§5.2, §5.3); the custom WebSocket server removed and replaced with Supabase Realtime subscriptions (§4.1). Everything with real business logic (orders, fulfillments, reconciliation, sessions, all provider webhooks) stays on the custom Express backend, since Supabase's auto-API isn't a fit for multi-step state transitions or third-party orchestration. **Impact**: Prisma is retained but scoped only to the tables the custom backend owns; RLS policies become part of this contract's security surface and must be reviewed with the same rigor as endpoint code (see §10).
- **G-11** (new): Redis, originally proposed for the idempotency key store, is dropped in favor of a `idempotency_keys` Postgres table in the same Supabase database, with a scheduled cleanup job. **Resolution**: removes a piece of infrastructure with no loss of correctness at this system's volume (low thousands of orders/month per the unit economics model) — revisit only if idempotency-check latency becomes a measured problem.

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

**Profile** (extends Supabase's `auth.users`, replaces the original custom AdminUser model — G-10): `id` (= `auth.users.id`), `role` (`admin` — single role in v1), `createdAt`. Password/credential handling lives entirely in Supabase Auth, never in our own tables.

**WebhookEvent**: `id`, `source` (`africas_talking|moolre`), `rawPayload` (stored for audit/replay — *internal only*, never exposed via public API; accessible only through direct DB access for engineering debugging), `receivedAt`.

**IdempotencyKey** (new — G-11, replaces the original Redis-backed store): `key` (the client-supplied `Idempotency-Key`, primary key), `requestBodyHash`, `responseBody`, `responseStatus`, `expiresAt`. *Internal only* — never exposed via any API response, purely infrastructure.

## 10. Security Baseline

- **JWT handling**: no custom signing — the backend only *verifies* Supabase-issued JWTs against `SUPABASE_JWT_SECRET` (or JWKS if the project uses RS256). Token lifetime, refresh, and rotation are entirely Supabase Auth's responsibility, not ours to re-implement.
- **Row Level Security is a first-class security control, not an implementation detail.** Every table exposed via Supabase's auto-API (`vendors`, `products`) must have RLS enabled with an explicit policy — a table with RLS *disabled* is effectively public to anyone with the anon key, so "did we enable and correctly scope RLS" is checked with the same rigor as endpoint auth in code review (see `.agents/agents.md`, @code-reviewer).
- **Service role key isolation**: `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) is a backend-only secret, used solely for the Prisma connection and for writing Orders on behalf of unauthenticated phone customers. It must never reach the frontend bundle, ever — treat a leak of this key as equivalent to a full database compromise.
- **Webhook verification**: since neither Africa's Talking nor Moolre document a cryptographic signature scheme, both inbound webhook endpoints require (a) a long random shared secret passed as a query parameter on the registered callback URL (not guessable, rotated if ever leaked in logs), and (b) a source-IP allowlist of each provider's published outbound IP ranges. This is a documented compensating control, not a substitute for real signature verification if either provider adds it later — revisit as Gap G-9 is resolved.
- **Secrets storage**: all API keys (Africa's Talking, Khaya, Anthropic, Google, Moolre, Supabase service role) live in environment variables injected at deploy time, never committed to the repository, never logged in plaintext (webhook payloads containing tokens must be redacted before writing to `WebhookEvent.rawPayload`).
- **File validation**: not applicable in v1 (no public file upload endpoint — see §2).
- **CORS policy**: admin dashboard origin only, explicit allowlist, no wildcard `*`, on the custom backend. (Supabase's own CORS/API settings are configured separately in the Supabase dashboard for the direct vendors/products calls.)
- **Rate limit scope**: per §2 — standard on custom backend endpoints, generous but present on webhook receivers. Supabase's own API has its own platform-level rate limiting, outside this contract's scope.
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
- [Supabase — Auth documentation](https://supabase.com/docs/guides/auth)
- [Supabase — Realtime documentation](https://supabase.com/docs/guides/realtime)
- [Supabase — Row Level Security guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Prisma — MongoDB connector limitations (referenced during DB decision — not used, kept for context)](https://www.prisma.io/docs/orm/overview/databases/mongodb)
