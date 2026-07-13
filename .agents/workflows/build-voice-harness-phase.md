# /build-voice-harness-phase <phase>

Orchestrates building one phase of the voice test harness (H0–H3), as @api-engineer, following `.agents/skills/dev-voice-harness.md`.

## Steps

1. **Read the harness docs** — `MAAME_VOICE_HARNESS_SPEC.md` (why/what), `MAAME_VOICE_HARNESS_API_CONTRACT.md` (exact endpoint/error shapes, gaps H-1 through H-3), `MAAME_VOICE_HARNESS_BUILD_PLAN.md` (this phase's checklist and acceptance criteria).
2. **Confirm the previous phase is done** — don't start H1 before H0's acceptance criteria are met, etc.
3. **If this is H0**: resolve Gap H-1 first — check whether `PaymentService`/`NotificationService`/`TransferService` in `src/integrations/moolre/` are already behind interfaces. If not, extract minimal ones before writing any mock.
4. **Build against `.agents/skills/dev-voice-harness.md`** — reuse `src/` clients directly, never fork them; mock boundary via dependency injection, never `if (isHarness)` branches in production code; route-mount guard checked in `server.ts`, not per-handler; no new Prisma models or Supabase tables.
5. **Self-review** — run the checklist at the end of `.agents/skills/dev-voice-harness.md`, including actually starting the server with `NODE_ENV=production` set and confirming the harness routes 404.
6. **Mark phase tasks complete** — update the checklist items for this phase in `MAAME_VOICE_HARNESS_BUILD_PLAN.md`, with a short note on how each acceptance criterion was verified.

## Output

A short summary: what was built, which contract section(s) it implements, confirmation the production-inert guard was actually tested (not just written), and anything flagged for @code-reviewer.
