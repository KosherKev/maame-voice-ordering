# Skill: Implementing an Admin Dashboard Page

Follow these steps in order for every page (Live Orders, Order Detail, Vendor Management, Product Catalog, Fulfillment, Reconciliation).

1. **Check the Page → Route Index first.** `MAAME_API_CONTRACT.md` §6 lists, for every page, exactly which calls it makes and in what order — and, per page, whether those calls go to the custom backend or directly to Supabase. Build against that sequence — don't guess.

2. **Two call patterns exist on this project — know which one this page uses.**
   - **Custom backend calls** (Orders, Fulfillment, Reconciliation, Order Detail's non-realtime data): a typed function per endpoint, matching contract §5's shapes exactly, in an API client module. Components never call `fetch` directly.
   - **Supabase-direct calls** (Login/logout, Vendor Management, Product Catalog, all Realtime subscriptions): use `supabase-js` directly — `supabase.auth.*`, `supabase.from('vendors').select()/insert()/update()/delete()`, `supabase.channel(...).on('postgres_changes', ...)`. Do not build a custom API client wrapper around these; that would just be reimplementing what `supabase-js` already does.

3. **Use the data-fetching library for all custom-backend server state.** TanStack Query (or equivalent) for every read and mutation against the custom backend — no manual `useState` + `useEffect` + `fetch`. For Supabase-direct calls, TanStack Query can still wrap `supabase-js` calls for caching consistency, but the underlying call is still `supabase-js`, not a custom fetch wrapper.

4. **Handle every error type from the contract's Error Catalogue (§3) with a specific, human-readable message.** A `422 invalid-state-transition` on `mark-delivered` should say something like "This order hasn't been paid yet" — not a generic failure toast. Map each `type` URI suffix to a message once, in a shared error-mapping utility, and reuse it everywhere.

5. **Build mobile-first**, even though this is an internal ops tool — staff may check the Live Orders board from a phone during a delivery run.

6. **Implement Realtime subscriptions with polling fallback.** Live Orders and Order Detail subscribe directly to Supabase Realtime channels (contract §4.1) via `supabase-js` — there is no custom WebSocket to connect to. `supabase-js` handles reconnection internally; add the defense-in-depth polling fallback (`GET /v1/orders?since=...` every 5 seconds, contract §4.1) and show a "live updates paused" indicator after 60 seconds without a successful update — don't fail silently.

7. **Never call a third-party API directly from the frontend, except Supabase.** Africa's Talking, Khaya, Moolre, Anthropic, and Google are all backend-only integrations — always go through the Maame API for those. Supabase is the one deliberate exception: Auth, Vendors/Products CRUD, and Realtime subscriptions are meant to be called directly from the frontend (G-10) — that's the whole point of "leaning into the platform."

## Self-review checklist before marking a page done

- [ ] Every call on this page matches contract §6's page-to-route index, in the documented order, via the correct pattern (custom backend vs. Supabase-direct)
- [ ] Custom-backend server state goes through the data-fetching library, no manual fetch/useEffect state
- [ ] Supabase-direct calls use `supabase-js`, not a hand-rolled fetch wrapper
- [ ] Every error type this page's endpoints can return has a specific, mapped message
- [ ] Realtime pages (Live Orders, Order Detail) have a working polling fallback, tested by simulating a Realtime disconnect
- [ ] No hardcoded field name or URL that contradicts the contract
- [ ] Page is usable on a small screen
