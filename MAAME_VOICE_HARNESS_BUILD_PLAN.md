# Maame Voice Test Harness — Build Plan

Sequential phases. References `MAAME_VOICE_HARNESS_API_CONTRACT.md` sections and gaps (H-1 through H-3).

---

## Phase H0 — Bootstrap & Mocking Boundary

**Goal**: the harness exists, is structurally incapable of running in production, and has real mock seams to build against.

- [ ] Create `tools/voice-harness/` (backend routes/services) and `tools/voice-harness/client/` (static HTML page)
- [ ] Resolve Gap H-1 first: check whether `PaymentService`, `NotificationService` (SMS), and `TransferService` are already behind interfaces in `src/integrations/moolre/`. If not, extract minimal interfaces (mirroring the existing `LlmClient` pattern) so mock implementations can be injected without touching production call sites.
- [ ] Write `MockPaymentService`, `MockNotificationService`, `MockTransferService` — each logs its call locally (to the session's JSON log) and returns a synthetic success response shaped like the real one, after a short artificial delay (mimicking real webhook latency so the order state machine's async handling gets exercised too)
- [ ] Route-mount guard: `if (process.env.NODE_ENV === 'production') { throw / skip mount }` around the harness router, with a loud boxed console warning whenever it *does* mount
- [ ] `.dev-voice-harness/` added to `.gitignore`

**Acceptance criteria**: starting the server with `NODE_ENV=production` results in the harness routes being unreachable (404, not just unauthenticated) with a log line confirming they were skipped; starting in development mounts them with a visible warning; the three mock services compile against whatever interface `PaymentService`/`NotificationService`/`TransferService` now expose.

---

## Phase H1 — Session & Turn Endpoints

**Goal**: a single audio clip can be sent through the real ASR → LLM → TTS pipeline and produce a sensible response.

- [ ] `POST /dev/voice-harness/sessions` — creates an in-memory session object (language, empty turn history, fresh order state) and a `.dev-voice-harness/{sessionId}/` directory
- [ ] `POST /dev/voice-harness/sessions/{sessionId}/turns` — multipart audio upload, magic-byte validation, then: `AsrClient.transcribe()` (real Khaya) → append to in-memory order state via the same matching logic the voice webhook uses → `LlmClient` structured decision (real Claude/Gemini, contract §7.3 shape) → `TtsClient.synthesize()` (real Khaya) → write the turn (transcript, decision, order state, audio file) to the session's local log → return the turn response (contract §4)
- [ ] Wire mocked services from Phase H0 for the payment/SMS/transfer steps in the order flow, so reaching `confirming_order` → `awaiting_payment` auto-resolves via `MockPaymentService` instead of hanging or erroring
- [ ] `GET /dev/voice-harness/sessions/{sessionId}` — reads the local log back
- [ ] `DELETE /dev/voice-harness/sessions/{sessionId}` — removes the directory

**Acceptance criteria**: recording yourself saying "I need rice, oil, and tomato paste" and sending it through a full session produces a correct transcript, plausible item matches against the seeded catalog, spoken audio you can actually listen to, and — after confirming the order — a turn response showing `mockedActions` fired instead of any real Moolre call.

---

## Phase H2 — Client

**Goal**: a no-dependency way to actually record and send audio without curling multipart forms by hand.

- [ ] `tools/voice-harness/client/index.html` — a single static page: start-session button, record button (MediaRecorder), auto-posts the clip to the current session on stop, renders the transcript/decision/order-state, plays the returned audio. Fetch calls use relative paths (`/dev/voice-harness/...`), not hardcoded origins.
- [ ] Statically serve `tools/voice-harness/client/` from the same Express app at a dev-only route (e.g. `app.use('/voice-harness', express.static(...))`), behind the identical `NODE_ENV !== 'production'` guard as the API routes — **do not** rely on opening `index.html` directly as a `file://` page; it breaks relative fetches and `getUserMedia` in most browsers (contract §2, spec §8)
- [ ] README section (or inline comment) documenting the CLI fallback: record a clip with `sox`/`arecord`, `curl -F audio=@clip.wav http://localhost:{PORT}/dev/voice-harness/sessions/{id}/turns`

**Acceptance criteria**: opening `http://localhost:{PORT}/voice-harness/index.html` (not a `file://` URL) and driving a full multi-turn conversation (add items, confirm, mock-pay) works entirely from the browser with no CORS errors and no other tooling open.

---

## Phase H3 — Review Loop

**Goal**: sessions are actually useful for debugging Khaya's Twi accuracy after the fact, not just live.

- [ ] Confirm `GET /dev/voice-harness/sessions/{sessionId}` returns enough detail (raw transcript per turn, confidence scores from `matchedItems`) to spot where ASR misheard an item vs. where the LLM matched wrong
- [ ] Optional: a tiny `list-sessions` script/endpoint that scans `.dev-voice-harness/` and prints a one-line summary per session (date, turn count, final order state) — only build this if manually browsing the directory becomes annoying in practice

**Acceptance criteria**: after a test session, you can answer "was that a transcription error or a matching error?" from the saved data alone, without re-running the turn.

---

## Out of scope for this build plan

Anything that would make this look like a second product: no auth system beyond the optional shared-secret header, no deployment target, no database schema, no addition to `MAAME_API_CONTRACT.md`. If any of these start to feel necessary, that's a signal the harness is scope-creeping into a real feature and should be re-scoped as one, not quietly expanded here.
