# Skill: Building/Extending the Voice Test Harness

Follow these steps for any work inside `tools/voice-harness/`. Read `MAAME_VOICE_HARNESS_SPEC.md` and `MAAME_VOICE_HARNESS_API_CONTRACT.md` first — this skill assumes you've read both.

1. **This is a satellite tool, not a feature of Maame.** Nothing here gets added to `MAAME_API_CONTRACT.md`, no Supabase table, no production route. If a task description sounds like it's asking you to make the harness more "real" (persistent sessions in the actual database, real payment testing, a deployed URL), stop and flag it — that's scope creep into a different feature, not this one.

2. **Reuse, never fork.** Import `AsrClient`, `LlmClient`, `TtsClient`, and the order-matching logic directly from `src/`. Never copy-paste or reimplement a parallel version "for testing" — the entire point is that a harness test result reflects what the real voice webhook would actually do.

3. **The mock boundary is structural, not conditional.** `MockPaymentService`, `MockNotificationService`, `MockTransferService` are separate classes implementing the same interface as their real counterparts (contract H-1) — the harness constructs its order service with the mocks injected, exactly like production code constructs it with the real ones. Never add `if (process.env.HARNESS_MODE)` branches inside `src/` service code. If you find yourself wanting to, that's a sign the interface extraction in H-1 isn't finished — go finish it instead.

4. **Route mounting is a hard gate, not a soft one.** The harness router must not be `app.use()`'d at all when `NODE_ENV === 'production'` — check this at the point of mounting in `server.ts`, not inside individual route handlers. A 404 from "never mounted" is the goal; a 403 from "mounted but rejected" is not good enough, since it still means harness code shipped to production.

5. **No new Prisma models, no new Supabase tables, ever, for this tool.** Session/turn data is local disk JSON under `.dev-voice-harness/` (contract §2). If a task seems to require database persistence for the harness, that's Gap H-2 territory — reread it before proceeding, the default answer is "don't."

6. **File validation still applies.** Uploaded audio is validated by magic bytes, same principle as anywhere else in this codebase that accepts files — a dev tool is not an excuse to skip it, since it's the only thing standing between "test tool" and "arbitrary file upload endpoint on a dev machine."

## Self-review checklist

- [ ] Nothing in `src/` imports anything from `tools/voice-harness/`
- [ ] The harness routes are unreachable (unmounted, not just unauthenticated) when `NODE_ENV=production` — verified by actually running with that env var set, not just reading the code
- [ ] Payment/SMS/transfer calls during a harness session are demonstrably mocked (check `mockedActions` in the turn response, or the local log)
- [ ] No new database schema was added for this tool
- [ ] Uploaded audio is validated by magic bytes before being sent to Khaya
