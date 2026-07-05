# Skill: Implementing an API Backend Module

Follow these steps in order for every module (vendors, products, orders, fulfillments, etc.).

1. **Read the contract first.** Open `MAAME_API_CONTRACT.md` and find the relevant subsection under §5 (Complete Endpoint Reference). Read every field, status code, and error response for this module before writing anything. Also check §9 (Data Models Reference) for the exact shape of the entity, and §8 (Logic Gap Analysis) for any resolution that affects this module (e.g. G-1 for fulfillments, G-2 for order items).

2. **Write the Zod schema before the controller.** Define request/response validation schemas matching the contract's field names, types, and constraints exactly. This schema is the enforcement point for "camelCase everywhere," "monetary amounts as integer pesewas," and "timestamps as ISO 8601 UTC."

3. **Put business logic in the service layer.** The service function contains the actual behavior (state transitions, calls to `integrations/`, database writes). It knows nothing about HTTP — it takes plain arguments and returns plain data or throws a typed domain error.

4. **Keep the controller as a thin HTTP adapter.** The controller: validates the request against the Zod schema, calls the service, maps the service's result or thrown error to an HTTP response. It contains no business logic itself.

5. **Use the shared error-throwing pattern.** Domain errors are thrown as typed exceptions (e.g. `NotFoundError`, `InvalidStateTransitionError`, `IdempotencyConflictError`) that the global error-handling middleware (Phase 0) catches and converts to the matching RFC 9457 response from the contract's Error Catalogue (§3). Never construct a raw HTTP response with an error body inside a controller — always throw and let the middleware format it.

6. **Use the shared pagination utility.** Every list endpoint uses the same cursor-encode/decode helper — never hand-roll a new pagination scheme per module.

7. **Validate files by magic bytes, not `Content-Type`, if this module ever handles uploads.** (Not applicable to any v1 endpoint — flag to a human if a future module seems to need file upload, since the contract currently has none.)

8. **Emit WebSocket events fire-and-forget.** After a successful mutation that the dashboard cares about (order status change, fulfillment delivered, disbursement completed), emit the corresponding event from contract §4.1 without blocking the HTTP response on delivery — the WebSocket layer has its own retry/fallback logic; the API response should not wait on it.

9. **Idempotency.** If this endpoint is a `POST`/`PATCH` that mutates state (especially anything touching Moolre — payments, transfers), wire the `Idempotency-Key` middleware and pass the key through as Moolre's `externalref` where applicable (contract §2, §7.4).

10. **Third-party integration calls go through `integrations/`, never inline.** A controller or service never constructs a raw HTTP call to Africa's Talking, Khaya, Moolre, Anthropic, or Google directly — it calls the matching client in `src/integrations/`.

## Self-review checklist before marking a module done

- [ ] Every endpoint in this module matches the contract's method, path, auth requirement, and idempotency requirement exactly
- [ ] Every success response field name is camelCase and matches contract §9's data model
- [ ] Every possible error response for this module is in the contract's Error Catalogue (§3) — no ad-hoc error shapes
- [ ] Monetary fields are integers in pesewas, never floats
- [ ] Timestamps are ISO 8601 UTC
- [ ] List endpoints use cursor pagination, not offset
- [ ] No secret, API key, or credential appears in this module's code or logs
- [ ] If this module touches a Gap (G-1 through G-9), the resolution described in the contract §8 is implemented, not reinterpreted
