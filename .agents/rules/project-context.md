# Project Context — Always Active

## What this product is

Maame is a voice- and USSD-first commerce platform for Ghana. A customer calls a shared phone number and speaks in Twi or English to an AI market-woman persona, or dials a shared USSD short code. The AI matches items against a ~30-product seeded vendor catalog, reads back the total, pushes a MoMo payment prompt mid-call, confirms payment, notifies the vendor by SMS, and disburses to the vendor's MoMo wallet once an ops admin confirms delivery. There is no customer-facing app or website — the only UI in this system is an internal admin dashboard for vendor/catalog management and live order monitoring.

## Source of truth documents

- **`MAAME_SPEC.md`** — product spec: roles, channels, data entities, order state machine, open design decisions (Gaps G-1 through G-5)
- **`MAAME_API_CONTRACT.md`** — the API contract. Every endpoint, error, event, and data model shape. **This is the single source of truth for implementation.** If code and contract disagree, the contract wins — update the contract first, then the code.
- **`MAAME_API_BUILD_PLAN.md`** — the phase-by-phase build order with acceptance criteria. Do not start a phase before the previous one's acceptance criteria are met.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Backend runtime | Node.js |
| Database | PostgreSQL |
| ORM/migrations | Prisma or Drizzle (pick one in Phase 0 and commit to it) |
| Validation | Zod |
| Real-time | WebSocket (native `ws` or Socket.IO) with polling fallback |
| Idempotency store | Redis |
| Voice | Africa's Talking Voice API |
| Speech (ASR + TTS) | GhanaNLP Khaya API, Standard tier |
| Conversation/matching LLM | Claude Haiku 4.5 or Gemini 2.5 Flash-Lite, behind one `LlmClient` interface, selected via `LLM_PROVIDER` env var |
| SMS / USSD / Payments / Disbursements | Moolre API |
| Admin frontend | React + TanStack Query (framework choice: confirm in Phase 2, e.g. Vite + React) |

## Monorepo folder structure (target)

```
maame/
├── MAAME_SPEC.md
├── MAAME_API_CONTRACT.md
├── MAAME_API_BUILD_PLAN.md
├── .agents/
├── src/
│   ├── config/          # env validation, constants
│   ├── db/               # schema, migrations, client
│   ├── modules/
│   │   ├── auth/
│   │   ├── vendors/
│   │   ├── products/
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
- **Idempotency**: every money-movement or state-mutating admin endpoint requires and honors the `Idempotency-Key` header per contract §2.
- **Unconfirmed integrations**: Gaps G-6 (Africa's Talking real-time audio streaming shape), G-7 (Moolre USSD inbound shape), and G-8 (Khaya raw request/response JSON) are explicitly marked "not confirmed from public docs" in the contract. Verify against a live account/sandbox before implementing the phase that needs them — do not guess field names and ship them as if confirmed.
- **LLM provider is config, not code branching**: business logic never checks "if using Claude" vs "if using Gemini" — it calls `LlmClient`, and the provider is selected once, at construction, via `LLM_PROVIDER`.
