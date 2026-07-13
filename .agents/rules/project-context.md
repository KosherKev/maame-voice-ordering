# Project Context — Always Active

## What this product is

Maame is a voice- and USSD-first commerce platform for Ghana. A customer calls a shared phone number and speaks in Twi or English to an AI market-woman persona, or dials a shared USSD short code. The AI matches items against a ~30-product seeded vendor catalog, reads back the total, pushes a MoMo payment prompt mid-call, confirms payment, notifies the vendor by SMS, and disburses to the vendor's MoMo wallet once an ops admin confirms delivery. There is no customer-facing app or website — the only UI in this system is an internal admin dashboard for vendor/catalog management and live order monitoring.

## Source of truth documents

- **`MAAME_SPEC.md`** — product spec: roles, channels, data entities, order state machine, open design decisions (Gaps G-1 through G-5)
- **`MAAME_API_CONTRACT.md`** — the API contract. Every endpoint, error, event, and data model shape. **This is the single source of truth for implementation.** If code and contract disagree, the contract wins — update the contract first, then the code.
- **`MAAME_API_BUILD_PLAN.md`** — the phase-by-phase build order with acceptance criteria. Do not start a phase before the previous one's acceptance criteria are met.
- **`MAAME_VOICE_HARNESS_SPEC.md`**, **`MAAME_VOICE_HARNESS_API_CONTRACT.md`**, **`MAAME_VOICE_HARNESS_BUILD_PLAN.md`** — a separate, satellite spec/contract/plan for the local dev-only voice test harness (`tools/voice-harness/`). This is **not part of the product** — it's a testing tool that reuses `AsrClient`/`LlmClient`/`TtsClient` to exercise the voice pipeline without a live Africa's Talking call. Never conflate its gaps (H-1, H-2, H-3) with the main contract's (G-1 through G-11), and never let it influence `MAAME_API_CONTRACT.md`.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Backend runtime | Node.js |
| Database | Supabase (hosted Postgres) |
| Auth | Supabase Auth — no custom JWT signing, no custom login/refresh/logout endpoints |
| Realtime | Supabase Realtime (Postgres change data capture) — no custom WebSocket server |
| ORM/migrations | Prisma, scoped only to custom-backend-owned tables (orders, order_items, vendor_fulfillments, payments, disbursements, call_sessions, ussd_sessions, webhook_events, idempotency_keys). Vendors and Products are **not** in the Prisma schema — they're Supabase-direct, managed by Supabase CLI migrations and RLS policies. |
| Validation | Zod |
| Idempotency store | A Postgres `idempotency_keys` table (via Prisma) with a scheduled cleanup job — no Redis |
| Voice | Africa's Talking Voice API |
| Speech (ASR + TTS) | GhanaNLP Khaya API, Standard tier |
| Conversation/matching LLM | Claude Haiku 4.5 or Gemini 2.5 Flash-Lite, behind one `LlmClient` interface, selected via `LLM_PROVIDER` env var |
| SMS / USSD / Payments / Disbursements | Moolre API |
| Admin frontend | React + TanStack Query, plus `supabase-js` called directly for Auth, Vendors/Products CRUD, and Realtime subscriptions (framework choice: confirm in Phase 2, e.g. Vite + React) |

**Why Prisma is still here despite moving to Supabase**: Supabase *is* Postgres, so nothing about Prisma's relational modeling or migrations stopped being useful — it's just no longer needed for the two tables (`vendors`, `products`) that Supabase's own auto-API and RLS now serve directly. Everything with real business logic (state machines, third-party orchestration, money movement) still goes through the custom backend, and Prisma is the right tool there.

## Monorepo folder structure (target)

```
maame/
├── MAAME_SPEC.md
├── MAAME_API_CONTRACT.md
├── MAAME_API_BUILD_PLAN.md
├── .agents/
├── supabase/
│   └── migrations/         # Supabase CLI migrations: profiles, vendors, products, RLS policies
├── src/
│   ├── config/          # env validation, constants
│   ├── db/               # Prisma schema, migrations, client — scoped tables only (no vendors/products)
│   ├── modules/
│   │   ├── orders/
│   │   ├── fulfillments/
│   │   ├── reconciliation/
│   │   ├── call-sessions/
│   │   ├── ussd-sessions/
│   │   └── webhooks/      # voice, ussd, moolre payment receivers
│   ├── integrations/
│   │   ├── africas-talking/
│   │   ├── khaya/          # AsrClient, TtsClient
│   │   ├── llm/            # LlmClient + ClaudeLlmClient + GeminiLlmClient
│   │   └── moolre/         # sms, ussd, collections, transfer
│   ├── middleware/         # error handler, auth, idempotency, rate limit, request-id
│   └── server.ts
├── web/                    # admin dashboard frontend
├── tools/
│   └── voice-harness/      # dev-only voice test harness — see MAAME_VOICE_HARNESS_*.md. Never imported by src/.
│       └── client/         # static HTML page, MediaRecorder-based
└── tests/
```

## Non-negotiable coding rules

- **Error format**: every error response is RFC 9457 `application/problem+json`, per contract §2–§3. No exceptions, no ad-hoc `{ "error": "..." }` shapes.
- **Validation**: every request body validated with a Zod schema before it reaches business logic.
- **No secrets in code**: all provider credentials come from environment variables validated at boot (Phase 0). Never commit a `.env` file. Never log a raw credential or webhook payload without redaction.
- **Pagination**: cursor-based only, per contract §2. No offset/page-number pagination anywhere.
- **Monetary amounts**: always integers in pesewas (1 GHS = 100 pesewas). Never floats, never GHS-with-decimals in the database or API.
- **Timestamps**: always ISO 8601 UTC strings.
- **Field names**: always camelCase in every API response.
- **Idempotency**: every money-movement or state-mutating admin endpoint requires and honors the `Idempotency-Key` header per contract §2, backed by the `idempotency_keys` Postgres table (no Redis).
- **Unconfirmed integrations**: Gaps G-6 (Africa's Talking real-time audio streaming shape), G-7 (Moolre USSD inbound shape), and G-8 (Khaya raw request/response JSON) are explicitly marked "not confirmed from public docs" in the contract. Verify against a live account/sandbox before implementing the phase that needs them — do not guess field names and ship them as if confirmed.
- **LLM provider is config, not code branching**: business logic never checks "if using Claude" vs "if using Gemini" — it calls `LlmClient`, and the provider is selected once, at construction, via `LLM_PROVIDER`.
- **No custom auth code**: never write JWT signing, password hashing, or session/refresh logic — that's Supabase Auth's job. The backend only verifies tokens Supabase already issued (G-10).
- **Row Level Security is not optional on any Supabase-direct table**: `vendors` and `products` must have RLS enabled with an explicit, tested policy before they're usable — a table with RLS off is effectively public.
- **Vendors and Products have no custom backend code**: don't build Express controllers, services, or routes for these two resources — that logic doesn't exist in this system anymore (G-10). The custom backend only *reads* them (via Prisma) when matching catalog items.
- **`tools/voice-harness/` is one-directional and production-inert**: it may import from `src/`, `src/` must never import from it. Its routes must be structurally unreachable when `NODE_ENV === 'production'` (not just unauthenticated — unmounted entirely). It must never call real Moolre payment/SMS/transfer endpoints — always through the mock services described in `MAAME_VOICE_HARNESS_API_CONTRACT.md` §5 (H-1). Treat any PR that blurs this boundary (e.g. adding an `if (isHarness)` branch inside a production service) as a review blocker, not a style nit.
