# Skill: Implementing an Admin Dashboard Page

Follow these steps in order for every page (Live Orders, Order Detail, Vendor Management, Product Catalog, Fulfillment, Reconciliation).

1. **Check the Page → Route Index first.** `MAAME_API_CONTRACT.md` §6 lists, for every page, exactly which endpoints it calls and in what order. Build against that sequence — don't guess which endpoint a page needs.

2. **Write the API client layer before the component.** A typed function per endpoint (matching contract §5's request/response shapes exactly) lives in an API client module. Components never call `fetch` directly.

3. **Use the data-fetching library for all server state.** TanStack Query (or equivalent) for every read and mutation — no manual `useState` + `useEffect` + `fetch` for anything that comes from the API. This gives you caching, refetch-on-focus, and mutation state for free, and keeps loading/error states consistent across the dashboard.

4. **Handle every error type from the contract's Error Catalogue (§3) with a specific, human-readable message.** A `422 invalid-state-transition` on `mark-delivered` should say something like "This order hasn't been paid yet" — not a generic failure toast. Map each `type` URI suffix to a message once, in a shared error-mapping utility, and reuse it everywhere.

5. **Build mobile-first**, even though this is an internal ops tool — staff may check the Live Orders board from a phone during a delivery run.

6. **Implement real-time subscriptions with polling fallback.** Live Orders and Order Detail subscribe to the WebSocket channels from contract §4.1. If the socket disconnects, fall back to polling `GET /v1/orders?since=...` every 5 seconds (contract §4.1) and show a "live updates paused" indicator after 60 seconds without a successful reconnect — don't fail silently.

7. **Never call a third-party API directly from the frontend.** Africa's Talking, Khaya, Moolre, Anthropic, and Google are all backend-only integrations. The frontend only ever talks to the Maame API.

## Self-review checklist before marking a page done

- [ ] Every endpoint call on this page matches contract §6's page-to-route index, in the documented order
- [ ] All server state goes through the data-fetching library, no manual fetch/useEffect state
- [ ] Every error type this page's endpoints can return has a specific, mapped message
- [ ] Real-time pages (Live Orders, Order Detail) have a working polling fallback, tested by simulating a socket disconnect
- [ ] No hardcoded field name or URL that contradicts the contract
- [ ] Page is usable on a small screen
