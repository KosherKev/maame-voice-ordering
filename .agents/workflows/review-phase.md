# /review-phase <number>

Orchestrates a full review of a completed build phase, as @code-reviewer.

## Steps

1. **Locate the phase** — Open `MAAME_API_BUILD_PLAN.md`, find phase `<number>`, and list every file that was created or modified to complete its checklist items.
2. **Check contract fidelity** — For every endpoint/event touched in this phase, diff the implementation against `MAAME_API_CONTRACT.md`: method, path, auth, idempotency, request/response field names and types, and every error response.
3. **Check security** — Confirm per `.agents/agents.md` (@code-reviewer priority order, item 2): no secrets in code/logs, webhook shared-secret + IP allowlist present where relevant, JWT handling correct, money-movement endpoints are idempotent.
4. **Check data integrity** — Foreign keys correct and match the migration order in `MAAME_API_BUILD_PLAN.md`'s Database Migration Order section; monetary fields are integer pesewas; timestamps ISO 8601 UTC.
5. **Check error handling** — Every failure path in this phase returns a contract-documented RFC 9457 body.
6. **Check TypeScript correctness** — No `any` escape hatches around contract-shaped data.
7. **Check performance** — No N+1 queries, missing pagination, or unbounded retry loops introduced in this phase.
8. **Check Gap resolutions** — If this phase touches G-1 through G-9, confirm the resolution in contract §8 was implemented, and that any "not confirmed" integration detail (G-6, G-7, G-8) was actually verified against a live account/sandbox before being implemented — not left as a guess.
9. **Verify acceptance criteria** — Confirm each acceptance criterion listed for this phase in `MAAME_API_BUILD_PLAN.md` is demonstrably met (not just "should work").

## Output

For each issue found: file, line, and reason, ordered by the priority list in step 2–7. End with either:
- **✅ LGTM** — phase is ready, all acceptance criteria met, no blocking issues
- **❌ BLOCK** — list of specific issues that must be fixed before this phase is considered done

If blocked, after fixes are made, re-run this workflow rather than assuming the fix is correct.
