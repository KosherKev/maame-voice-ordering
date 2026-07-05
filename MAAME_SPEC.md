# Maame — Product Specification

Version 1.0 — draft for review before API contract is written.

## 1. Product Summary

Maame is a voice- and USSD-first commerce platform for Ghana. A customer dials a shared phone number and speaks to an AI market-woman persona in Twi or English (voice channel), or dials a shared USSD short code and navigates a menu (USSD channel — a fallback for customers who can't or don't want a voice call). The AI matches spoken/selected items against a seeded vendor catalog (~30 products at launch), reads back the order total, pushes a MoMo payment prompt to the customer's phone mid-session, confirms payment, notifies the vendor by SMS, and — once delivery is confirmed — disburses payment to the vendor's mobile money wallet.

There is no customer-facing app or website. An internal admin/ops web dashboard exists for the Maame team to manage vendors, manage the product catalog, monitor live orders, mark deliveries, and reconcile money in vs. money out.

## 2. User Roles

| Role | Identified by | Can do |
|---|---|---|
| **Customer** | Phone number (no login/account) | Call the voice number or dial the USSD code, speak/select items, confirm an order, approve a MoMo payment prompt |
| **Vendor** | Phone number + Moolre MoMo channel, onboarded by ops | Receives SMS order notifications. Does not have a login or app in v1 (see §8, Gap G-1, for how delivery gets confirmed) |
| **Admin/Ops** | Staff login on the dashboard | Manage vendors, manage product catalog, view live orders and call/USSD transcripts, mark a vendor fulfillment as delivered, view reconciliation, retry failed payments/disbursements |
| **System actor — "Maame" AI** | N/A | Not a human role. The conversational logic layer (ASR → LLM matching → TTS) that drives both the voice and USSD ordering flows |

## 3. Channels

### 3.1 Voice Channel (primary)

Inbound call → Africa's Talking webhook → backend creates a `CallSession` → greeting is played → item-collection loop (ASR transcribes each customer utterance, LLM matches against catalog, TTS reads back Maame's response) → order summary and confirmation → Moolre payment push → payment result → vendor SMS notification → call ends with a confirmation message.

Call states: `greeting` → `collecting_items` → `clarifying_item` (loops back to collecting) → `confirming_order` → `awaiting_payment` → `payment_failed_retry` (loops back to awaiting_payment, capped retries) → `order_confirmed` → `call_ended`. A customer can hang up at any state, which must be handled as `abandoned`, not left dangling.

### 3.2 USSD Channel (fallback, built after voice is working)

Customer dials the shared Moolre USSD code. Menu-driven: language select → browse by category or search → add item → set quantity → review basket → confirm → Moolre's native USSD payment prompt (the same `Initiate Payment` flow used on the voice channel, but tied to the USSD `sessionid`) → confirmation screen.

The USSD channel reuses the same order engine (matching, catalog, order state machine) as voice — it's a different input/output adapter on top of the same core, not a separate product.

### 3.3 Admin Web Dashboard (internal, staff-only)

The one place traditional "pages" exist in this system.

| Page | Purpose |
|---|---|
| Login | Staff authentication |
| Live Orders | Real-time list of in-flight and recent orders — call/USSD status, payment status, items, vendor(s). This is also the screen shown next to the live demo call. |
| Order Detail | Full transcript (voice or USSD), item match confidence, payment and disbursement trail for one order |
| Vendor Management | CRUD for vendors — name, phone, MoMo channel/network, active/inactive |
| Product Catalog | CRUD for the ~30 seed products — name, price, vendor assignment, stock toggle |
| Fulfillment | Mark a vendor's portion of an order as delivered (this action triggers disbursement — see G-1) |
| Reconciliation | Collections in vs. disbursements out, Moolre fees taken, outstanding/unsettled balances |

## 4. Third-Party Dependencies

| Service | Used for | Key facts |
|---|---|---|
| **Africa's Talking Voice API** | Inbound call handling for the voice channel | Ghana incoming calls: GHS 0.009/min. Virtual number rental: GHS 300+VAT/month. Webhook-based call event model. |
| **GhanaNLP Khaya API** | Twi/English ASR and TTS | Standard tier: $89.95/month, 20,000 requests/month, one request = one API call regardless of audio length |
| **LLM — Claude Haiku 4.5 and/or Gemini 2.5 Flash-Lite** | Conversation logic — matches spoken/typed input to catalog items, drives dialogue state, decides when to ask clarifying questions vs. confirm | Claude Haiku 4.5: ~$1/$5 per 1M input/output tokens. Gemini 2.5 Flash-Lite: ~$0.10/$0.40 per 1M tokens (~90% cheaper). Both are supported behind one provider-agnostic LLM client interface (see §8, G-5) rather than hard-committing to one — default is Haiku 4.5 for reliability on multi-turn state tracking, with Flash-Lite available as a cost-optimized swap once side-by-side accuracy testing on real catalog-matching conversations is done. |
| **Moolre** | SMS (vendor notifications), USSD (fallback channel), Collections (customer payment push), Transfer (vendor disbursement) | All four are used deliberately — see contract §7 for exact endpoints |

## 5. Core Data Entities

- **Vendor** — name, phone, MoMo channel/network, active flag
- **Product** — name, price, vendorId, stock flag, category
- **Customer** — phone number only; no account, no auth, no stored profile beyond order history by phone number
- **Order** — customer phone, channel (voice/ussd), overall status, total, createdAt
- **OrderItem** — orderId, productId, vendorId, quantity, unitPrice (schema is multi-vendor-capable from day one — see §8, Gap G-2 — even though v1's matching logic always assigns every item in an order to a single vendor)
- **VendorFulfillment** — one per vendor involved in an order (always exactly one in v1), subtotal, delivery status, disbursement status/reference
- **Payment** — Moolre collection transaction reference, order, amount, status
- **Disbursement** — Moolre transfer transaction reference, vendorFulfillmentId, amount, status
- **CallSession** — call id, phone, current state, transcript log, timestamps
- **USSDSession** — session id, phone, current menu state, basket, timestamps
- **AdminUser** — staff login, role
- **WebhookEvent** — raw log of every inbound webhook from Africa's Talking and Moolre, for audit/debugging and replay

## 6. Order State Machine

```
collecting_items → confirming_order → awaiting_payment → paid → vendor_notified → out_for_delivery → delivered → disbursed
                                            ↓ (failure)
                                      payment_failed → retry (back to awaiting_payment) or abandoned
```

`VendorFulfillment` carries its own delivery/disbursement sub-status so that when multi-vendor orders ship (§8, G-2), each vendor's portion can progress independently without changing the Order-level status model.

## 7. Real-Time / Async Behaviour

- **Africa's Talking**: call-started, DTMF/speech, call-ended events arrive as webhooks.
- **Moolre Collections**: payment result arrives as an async webhook to our callback URL.
- **Moolre Transfer (disbursement)**: the API reference shows a status-check endpoint (`transact/status`) rather than a documented push webhook for transfers — treated as a polling case (see §8, G-3).
- **Moolre SMS**: delivery status is polled via the SMS status endpoint.
- **Admin dashboard**: live order updates pushed to the Live Orders page via WebSocket, with a polling fallback if the socket drops.

## 8. Open Design Decisions (resolved here, flag if you'd resolve differently)

- **G-1 — Who confirms delivery, triggering disbursement?** Vendors have no app or login in v1. Resolution: an ops/admin staff member marks a `VendorFulfillment` as "delivered" on the dashboard (e.g., after a confirmation call/message with the vendor), which triggers the Moolre disbursement. Fast-follow option for later: a two-way SMS keyword reply from the vendor (`DONE <orderId>`) auto-marks delivery — deferred because it requires inbound SMS webhook handling not yet scoped.
- **G-2 — Single-vendor vs. multi-vendor orders.** v1's matching logic always resolves an order to one vendor (simpler, more reliable to demo). The data model (`OrderItem.vendorId`, `VendorFulfillment` as a first-class entity) is built multi-vendor-capable from day one so that splitting a basket across vendors later is a change to the matching algorithm only, not a schema migration.
- **G-3 — Disbursement confirmation.** Since Moolre's transfer flow doesn't clearly document a push webhook, the backend polls `transact/status` after initiating a transfer, with retry/backoff, rather than waiting on a callback. Revisit if Moolre confirms webhook support for transfers.
- **G-4 — Abandoned calls/sessions.** Any `CallSession` or `USSDSession` that goes idle past a timeout (no customer input) or hangs up mid-flow is marked `abandoned`, not left in a live state indefinitely. This matters for the cost model (§9) since abandoned calls still burn voice/ASR/LLM minutes.
- **G-5 — LLM provider is swappable, not hardcoded.** Both Claude Haiku 4.5 and Gemini 2.5 Flash-Lite are in scope. The matching/dialogue logic sits behind a single internal `LlmClient` interface (prompt in, structured decision out) with two concrete implementations selected by config/environment variable — never a provider SDK call made directly from business logic. This makes the cost-vs-reliability tradeoff a config change, not a code change, and lets the two be A/B tested on real call transcripts before picking a permanent default.

## 9. Cost & Pricing Assumptions Carried Into This Spec

Sourced from the unit economics model built earlier (`Maame_Unit_Economics_Model.xlsx`):

- ~30-product catalog at launch
- Flat service/delivery fee per order (modeled at GHS 8, configurable), not a percentage commission — because voice/ASR/LLM costs are per-call, not per-cedi
- Africa's Talking, Khaya Standard tier, Claude Haiku 4.5, and Moolre (SMS/USSD/Collections/Transfer) are the exact providers and tiers this spec is written against

## 10. Build Phasing (sequential — not time-boxed)

1. Core backend bootstrap, database, admin auth
2. Vendor + Product catalog CRUD (admin dashboard backend + minimal frontend) — needed early to seed the ~30-item catalog
3. Voice channel: Africa's Talking integration, Khaya ASR/TTS, Claude matching logic, order state machine
4. Moolre Collections (payment push) + webhook handling
5. Vendor SMS notification + admin delivery marking (G-1) + Moolre disbursement
6. Admin dashboard live order monitoring (real-time) + reconciliation view
7. USSD channel (Moolre USSD), reusing the order engine built for voice
8. Hardening: abandoned session handling (G-4), payment retry logic, disbursement polling (G-3), logic-gap fixes found during build
