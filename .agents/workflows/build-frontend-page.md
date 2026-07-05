# /build-frontend-page <page> <route>

Orchestrates building one admin dashboard page, end to end, as @frontend-engineer.

## Steps

1. **Read page-to-route index** — Open `MAAME_API_CONTRACT.md` §6, find the `<page>` row, and note the exact endpoints and call order.
2. **Build API client** — Add/confirm typed client functions for each endpoint this page needs, matching contract §5 request/response shapes exactly.
3. **Build hooks** — Wrap each API client call in a data-fetching library hook (query for reads, mutation for writes), including cache invalidation between related hooks (e.g. marking a fulfillment delivered should invalidate the order detail query).
4. **Build component** — Implement the page UI, consuming the hooks. Map every error type this page can encounter (per `.agents/skills/frontend.md`, step 4) to a specific message.
5. **Register route** — Wire the page to `<route>` in the frontend router.
6. **Self-review** — Run through the checklist at the end of `.agents/skills/frontend.md`, including a manual test of the WebSocket-disconnect → polling-fallback path if this page subscribes to real-time events.

## Output

A short summary: which endpoints this page calls, confirmation the call order matches contract §6, which error states were handled, and whether real-time + fallback was tested (if applicable).
