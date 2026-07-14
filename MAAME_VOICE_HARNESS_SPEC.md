# Maame Voice Test Harness — Spec

A local, dev-only tool for testing the voice conversational pipeline (ASR → LLM matching → order state → TTS) without a live Africa's Talking phone call. Built to unblock development while AT's Service Order Form is pending, and to remain useful afterward as a fast local dev loop — real phone calls are slow to iterate against.

## 1. Why this exists

Africa's Talking has no real Voice sandbox — testing normally requires a live number. The riskiest parts of Maame (Khaya's Twi ASR accuracy, the LLM's catalog-matching, TTS naturalness, turn latency) have nothing to do with AT's telephony layer — they live entirely in code Maame already owns (`AsrClient`, `LlmClient`, `TtsClient`, the order state machine). This harness gives that code a second front door that doesn't require AT at all.

## 2. Scope

**In scope**: a way to send an audio clip (recorded locally) through the exact same `AsrClient` → `LlmClient` → order-matching → `TtsClient` path the real voice webhook uses, and get back a transcript, the LLM's structured decision, the order's resulting state, and synthesized audio to listen to.

**Explicitly out of scope**: no real Moolre payment prompts, no real vendor SMS, no real disbursements. This is a hard requirement, not a nice-to-have — the harness must not be able to move money or contact a real vendor, no matter how a test session is used.

**Not a product surface**: this is not part of Maame's customer-facing system, not covered by `MAAME_API_CONTRACT.md`, and never deployed to production. See §6 for the enforcement mechanism.

## 3. Who uses it

Whoever's building or reviewing the voice channel, from a terminal or browser tab on their own machine. No customer, vendor, or ops-dashboard user ever touches this.

## 4. How a test session works

1. Start a session (optionally specifying language — Twi or English).
2. Record a short clip of yourself speaking an order (e.g. "I need rice, oil, and tomato paste").
3. Send it to the harness. It runs the clip through the real `AsrClient` (Khaya), the transcript through the real `LlmClient` (Claude Haiku 4.5 or Gemini 2.5 Flash-Lite, whichever `LLM_PROVIDER` is set to), advances the same order state machine the production code uses, and synthesizes Maame's response via the real `TtsClient`.
4. You get back the transcript, the LLM's structured decision, the updated order state, and audio to play back and judge for yourself.
5. Repeat turns against the same session to simulate a full multi-turn conversation (add item, clarify, confirm) — same session ID threading through, same as a real call.
6. When the order reaches `confirming_order` and would normally trigger a Moolre payment push, the harness auto-completes a **mocked** payment instead (see §5) so you can also exercise the "what happens after payment" logic (vendor notification, fulfillment) without it doing anything real.

## 5. Mocking boundary

Real: `AsrClient` (Khaya ASR), `LlmClient` (Claude/Gemini), `TtsClient` (Khaya TTS), the order state machine and catalog matching.

Mocked: Moolre `Initiate Payment` (auto-resolves to a fake "success" after a short delay, mimicking the real webhook), Moolre SMS to vendors (logged locally, never sent), Moolre `Initiate Transfer` (logged locally, never sent). See H-1 in the build plan for what this requires from the existing codebase.

## 6. Non-negotiable safety constraint

The harness's routes must be structurally incapable of running in production — not just "off by default." The server refuses to mount `/dev/voice-harness/*` routes at all unless `NODE_ENV !== 'production'`, and logs a loud, impossible-to-miss warning on boot whenever those routes are active. This isn't about hiding a feature flag; it's about making sure nobody accidentally exposes a route that can trigger AI/LLM spend and — if the mocking boundary in §5 were ever bypassed by mistake — real money movement.

## 7. Where it lives in the repo

`tools/voice-harness/` — a self-contained module that imports `AsrClient`/`LlmClient`/`TtsClient` and the order service from `src/`, but is never imported *by* `src/` (one-directional dependency, so production code never depends on harness code). Test session data (transcripts, decisions, audio files) is written to `.dev-voice-harness/` on local disk, gitignored — not the production Supabase database, so there's no risk of harness noise polluting real data or requiring a schema change to the actual product.

## 8. Client

A single static HTML page (`tools/voice-harness/client/index.html`) using the browser's `MediaRecorder` API to record and play audio, calling the harness's local API directly — no build step, no framework.

**Must be served by the dev server, not opened as a `file://` page.** Opening it directly causes two real problems, not just a style preference: relative `fetch()` calls resolve against the `file://` origin instead of the API server (breaking every request), and `getUserMedia` (mic access) is unreliable or blocked outright on `file://` in most browsers, which don't treat it as a secure context the way `http://localhost` is. The Express app must statically serve `tools/voice-harness/client/` at a dev-only route (e.g. `/voice-harness`), guarded by the same `NODE_ENV !== 'production'` check as the API routes, so the page and the API are same-origin — open it at `http://localhost:{PORT}/voice-harness/index.html`. A CLI alternative (record via `sox`/`arecord`, `curl` the endpoint) is documented as a fallback for headless use, but the HTML page is the primary intended client.
