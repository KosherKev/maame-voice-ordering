# /build-api-module <module> <phase>

Orchestrates building one backend module, end to end, as @api-engineer.

## Steps

1. **Read contract** — Open `MAAME_API_CONTRACT.md`, find the `<module>` subsection under §5, and its entity under §9. Note any related Gap in §8.
2. **Read build plan** — Confirm `<phase>` in `MAAME_API_BUILD_PLAN.md` matches this module and that its prerequisite phases are already marked complete. Stop and report if not.
3. **Build schema** — Write the Zod request/response schemas for every endpoint in this module (per `.agents/skills/api-backend.md`, step 2).
4. **Build service** — Implement the business logic layer: state transitions, integration calls, database writes (step 3).
5. **Build controller** — Thin HTTP adapter wiring schema validation → service → response mapping (step 4).
6. **Build router** — Wire routes to controller functions with the correct method, path, auth middleware, and idempotency middleware per the contract.
7. **Wire into app** — Register the router in the main app, confirm it's reachable.
8. **Self-review** — Run through the checklist at the end of `.agents/skills/api-backend.md`. Fix anything that fails before proceeding.
9. **Mark phase tasks complete** — Update the corresponding checklist items in `MAAME_API_BUILD_PLAN.md` for `<phase>` and confirm the phase's acceptance criteria are met (write a short note on how each was verified).

## Output

A short summary: what was built, which contract sections it implements, which acceptance criteria are now met, and anything flagged for @code-reviewer (especially any Gap G-6/G-7/G-8 assumption that still needs live verification).
