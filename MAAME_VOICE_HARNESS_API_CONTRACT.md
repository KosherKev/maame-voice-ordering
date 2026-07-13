# Maame Voice Test Harness — API Contract

Source of truth for the harness's own small API surface. This is a satellite contract, not part of `MAAME_API_CONTRACT.md` — the harness is dev tooling, not a product surface, and is never deployed. Where this contract is silent, defer to the main contract's conventions (RFC 9457 errors, camelCase, ISO 8601 timestamps).

## 1. Document Governance

This document is the source of truth for the harness's routes only. It follows the same discipline as the main contract (update the doc before changing behavior) but carries none of the main contract's production obligations (no SLA, no versioning strategy, no breaking-change policy) — this is internal dev tooling, and can change freely as long as this file is kept current.

## 2. Global Conventions

- **Base URL**: `http://localhost:{PORT}/dev/voice-harness` — never a public URL, ever.
- **Mount guard**: the Express app refuses to register these routes unless `process.env.NODE_ENV !== 'production'`. On mount, log a boxed, hard-to-miss warning to stdout. This is checked in code review with the same weight as an auth bug in the main product (see `.agents/skills/dev-voice-harness.md`).
- **Auth**: none by default (assumes localhost-only use). If run on a shared dev machine reachable by teammates, set `HARNESS_SHARED_SECRET` and require it as a `X-Harness-Key` header — optional, off by default.
- **Content types**: JSON for all responses. Audio upload is `multipart/form-data` (field name `audio`); audio in responses is base64-encoded in a JSON field (small clips, no need for a separate binary response type here).
- **Error format**: RFC 9457, same shape as the main contract (`application/problem+json`), reusing the same global error handler middleware — no separate error-handling code path.
- **File validation**: uploaded audio is validated by magic bytes, not `Content-Type` header (same principle as the main contract's file-upload guidance, actually enforced here since this endpoint really does accept uploads). Accepted formats: `audio/wav`, `audio/webm`. Max 2 minutes / 10MB per clip — generous for a single conversational turn, tight enough to keep local storage sane across many test runs.
- **Persistence**: local disk under `.dev-voice-harness/{sessionId}/`, not the Supabase database. No new Prisma models, no new Supabase tables — this tool must not touch the production schema at all.

## 3. Error Catalogue

| Type URI suffix | Status | Title | When it occurs |
|---|---|---|---|
| `validation-error` | 400 | Validation error | Missing/invalid audio field, bad language code, malformed request |
| `not-found` | 404 | Not found | Unknown `sessionId` |
| `harness-disabled` | 403 | Harness disabled | Somehow reached in a `NODE_ENV=production` process (should be structurally impossible per §2 — this entry exists so the failure mode is documented, not silently a 500) |
| `asr-provider-error` | 502 | ASR provider error | Khaya ASR call failed or timed out |
| `llm-provider-error` | 502 | LLM provider error | Claude/Gemini call failed or returned an unparseable decision |
| `tts-provider-error` | 502 | TTS provider error | Khaya TTS call failed or timed out |
| `internal-error` | 500 | Internal error | Unhandled exception |

## 4. Endpoint Reference

**`POST /dev/voice-harness/sessions`** — start a new test session.
Request: `{ "language": "tw" | "en" (optional, default "tw") }`
Response `201`: `{ "sessionId": "string", "language": "tw" | "en", "createdAt": "ISO8601" }`

**`POST /dev/voice-harness/sessions/{sessionId}/turns`** — send one conversational turn.
Request: `multipart/form-data`, field `audio` (the recorded clip).
Response `200`:
```json
{
  "turnNumber": 1,
  "transcript": "me pɛ rice, oil, ne tomato paste",
  "llmDecision": {
    "intent": "add_item",
    "matchedItems": [
      { "productId": "prod_123", "quantity": 1, "confidence": 0.92 }
    ],
    "clarifyingQuestion": null,
    "orderSummaryText": null
  },
  "orderState": "collecting_items",
  "assistantAudioBase64": "string",
  "mockedActions": []
}
```
`mockedActions` lists any mocked side effects that fired this turn (e.g. `["payment_auto_completed", "vendor_sms_logged"]`), so it's obvious from the response alone that nothing real happened.
Errors: `not-found`, `validation-error`, `asr-provider-error`, `llm-provider-error`, `tts-provider-error`

**`GET /dev/voice-harness/sessions/{sessionId}`** — full turn history, for reviewing a session after the fact (e.g. checking where Twi ASR misheard an item).
Response `200`: `{ "sessionId", "language", "orderState", "turns": [ /* same shape as a turn response, minus assistantAudioBase64 unless ?includeAudio=true */ ], "createdAt" }`
Errors: `not-found`

**`DELETE /dev/voice-harness/sessions/{sessionId}`** — delete a session's local files (transcripts, decisions, audio).
Response `204`
Errors: `not-found`

## 5. Gap Analysis (harness-specific — prefixed H- to avoid clashing with the main contract's G-numbers)

- **H-1 — Payment/SMS/Transfer must be mockable without touching production code.** The main build plan didn't require `PaymentService`/`NotificationService`/`TransferService` to sit behind swappable interfaces the way `LlmClient` does (only the LLM was explicitly required to be provider-agnostic). **Resolution**: before building the harness, confirm whether these services are already behind an interface. If not, extract a minimal one (same pattern as `LlmClient`) so the harness can inject `MockPaymentService`/`MockNotificationService`/`MockTransferService` via dependency injection, rather than adding `if (isHarness)` branches inside production service code. This keeps the mocking boundary structural, not conditional — the production code path is identical whether it's ever run from the harness or not.
- **H-2 — Session/order records must not collide with real data.** Harness-created `Order`/`OrderItem` rows would otherwise land in the same Supabase tables as real orders. **Resolution**: the harness never writes to the production `orders`/`order_items` tables at all — the order state machine logic is exercised in-memory only, with state persisted to the local `.dev-voice-harness/` JSON log (§2), not the database. If in-memory-only state ever proves insufficient for a realistic test (e.g. testing something that genuinely requires a DB round-trip), revisit with a `isTestOrder: true` flag and explicit exclusion from `GET /v1/orders` and reconciliation — but default to no DB writes at all until that's proven necessary.
- **H-3 — Audio storage growth.** Repeated local testing accumulates audio files. **Resolution**: no automatic cleanup in v1 (it's local disk, developer's own machine) — `DELETE /dev/voice-harness/sessions/{sessionId}` exists for manual cleanup; add a `.dev-voice-harness/` size warning in the CLI/README if this becomes annoying in practice.

## 6. References

- `MAAME_SPEC.md`, `MAAME_API_CONTRACT.md` — the production system this harness tests against
- `MAAME_VOICE_HARNESS_SPEC.md` — product spec for this tool
