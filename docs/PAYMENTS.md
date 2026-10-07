# Bawi Shopping — Payments

**Merchant-of-record: resolved.** Bawi Shopping is the merchant of record for every transaction — not a proposal, not an open question. See [`DECISIONS.md`](DECISIONS.md) for the full decision. Everything below was already designed on this assumption; this note confirms it's now final.

## 1. Principles

- **Stripe Connect only.** No custom card storage, no alternate payment rails in v1.
- **Stripe is the only system that ever sees card data.** The storefront uses Stripe's Payment Element (Stripe.js); the backend only ever handles a `PaymentIntent` ID and its status — never a PAN, CVC, or raw card number.
- **Bawi Shopping's own Stripe platform account is merchant of record — final, not provisional.** Customers pay Bawi once per checkout; Bawi then moves seller shares out via Stripe Connect Transfers. A vendor never appears as the customer-facing merchant on any receipt, statement descriptor, or Payment Element — that's the direct-charges pattern, and it's explicitly not used (see §2-3).
- **All money math is integer cents.** No floating-point currency arithmetic anywhere in the codebase. Rates (commission, etc.) are basis-points integers, resolved via `business-config` (see [`DECISIONS.md`](DECISIONS.md)) — never a hardcoded literal in checkout/order/payout logic.
- **Every webhook handler is idempotent**, tracked via the `processed_webhook_event` table (`(provider, event_id)` unique, see [`DATABASE.md`](DATABASE.md)) — Stripe redelivers events; the same event ID must never apply its side effect twice. This same idempotency discipline applies to every Stripe operation that moves money or state (payment, transfer, refund, dispute), not only inbound webhooks.
- **Stripe test mode only, until an explicit, separate production-launch approval.** No `live_payments_enabled`/`real_transfers_enabled`/`real_payouts_enabled`/`real_refunds_enabled` feature flag is ever `true` by default, by migration, or by seed script — see [`DECISIONS.md`](DECISIONS.md).
- **Bawi's own database never stores bank account numbers, identity documents, tax IDs, or a full Stripe account object.** Only an opaque `stripe_account_id` reference plus onboarding-status booleans, derived exclusively from `account.updated` webhooks — see §2 and [`DATABASE.md`](DATABASE.md).

## 2. Connect account type: Express *(seller onboarding implemented)*

Sellers onboard as **Stripe Connect Express** accounts:

- Stripe hosts the onboarding UI (KYC, bank account) and the seller's payout dashboard — the platform never collects or stores bank details or identity documents. The platform's own database stores exactly one Stripe reference (`seller.stripe_account_id`) plus three status booleans (`stripe_charges_enabled`, `stripe_payouts_enabled`, `stripe_details_submitted`), all derived from `account.updated` webhooks — never the raw webhook payload, never a bank/identity/tax field. See [`DECISIONS.md`](DECISIONS.md), [`DATABASE.md`](DATABASE.md).
- Onboarding flow: the seller-authenticated `POST /seller/stripe/onboarding-link` creates (or reuses) the seller's Express account and returns a single-use, short-lived Stripe Account Link URL; the seller portal redirects there. Stripe redirects back to a seller-portal `return_url` on completion or `refresh_url` if the link expired — neither URL is ever cached or logged (see [`SECURITY.md`](SECURITY.md) §8). `GET /seller/me` reports the seller's own connection status (never the raw account id) so the seller portal can show "not connected / pending / live."
- The platform retains control over branding/UX for everything except the onboarding and payout-dashboard steps Stripe hosts, which fits "professional, clean, platform-branded" while keeping compliance burden on Stripe.
- Alternative considered: **Standard** accounts (seller manages their own full Stripe dashboard/relationship — too much control ceded, weaker platform branding) and **Custom** accounts (fully white-labeled, but shifts significant compliance/liability onto the platform, unnecessary for v1). Express is the right default for an Amazon-Marketplace-style model where the platform, not the seller, is the customer-facing brand.

### 2a. Ethiopia (ETB-priced sellers) is explicitly out of scope for Stripe

The platform is USD+ETB, US+Ethiopia (see `CLAUDE.md`'s "Currency and market" section) — but **Stripe has zero support for Ethiopia**, confirmed directly against Stripe's own country-availability documentation: not merchant/platform accounts, not Connect. Everything in this document (Express onboarding, Separate Charges and Transfers, commission/payout mechanics) continues to apply exactly as written for **USD-priced sellers only**. ETB-priced sellers get real transactional pricing (`seller.currency_code = 'etb'`, real product prices, real cart/order totals — see `DATABASE.md`) but no working payout mechanism yet.

**This is a known, permanent external integration gap, not a placeholder to fill in later with more of this codebase's own work.** No fake/simulated Ethiopian payment rail has been built or should be built - `apps/backend/src/payments/stripe-payment-client.ts`'s `StripePaymentClient` interface (real/fake implementations behind one factory function, the same swappable-provider shape as `packages/search-contract`'s `SearchService`) is the seam a real Ethiopian payment client (e.g. Telebirr, once API access is available) should implement, not a rewrite of any calling workflow. Until that integration exists: mobile checkout (`apps/mobile-customer/src/app/checkout.tsx`) explicitly blocks ETB carts with a clear in-app message rather than attempting a charge Stripe can't settle to the seller, and the mobile seller dashboard's Stripe-connect card shows the same explanation instead of an onboarding button for ETB-priced sellers. USD-priced sellers are fully unaffected - USD checkout is built and live on both the web storefront and mobile.

## 3. Payment pattern: Separate Charges and Transfers *(fully implemented)*

For a cart spanning multiple sellers, the customer must pay once. Stripe Connect's **Separate Charges and Transfers** pattern fits this exactly:

1. **Implemented.** At checkout, the backend creates one `PaymentIntent` **on the platform's own Stripe account** for the full cart total (all sellers combined) — `POST /store/checkout`, `src/workflows/start-checkout.ts`.
2. **Implemented.** The customer confirms payment once via Stripe Payment Element (storefront, `@stripe/react-stripe-js`).
3. **Implemented.** On successful capture (`payment_intent.succeeded` webhook), the checkout workflow splits the order into per-seller `VendorOrder`s (see [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md)), snapshots a commission rate/amount directly on each `VendorOrder`, and creates a corresponding `CommissionLedgerEntry` in the same step (financial-operations slice).
4. **Implemented.** On an admin-triggered payout batch, once a ledger entry's transfer-hold period has passed, the platform creates a Stripe **Transfer** (test mode) to each seller's connected Express account for their net amount (subtotal minus commission). Transfers are decoupled from the initial charge and from checkout timing entirely - see §5.

This is preferred over the alternative **Destination Charges** pattern (one `PaymentIntent` per seller, each with a `transfer_data.destination`) because destination charges require either multiple customer-facing PaymentIntents for a multi-seller cart (bad UX — the explicit thing this platform is designed to avoid) or complex on-behalf-of logic to fake a single charge across destinations. Separate Charges and Transfers naturally supports "one payment, N sellers" and gives the platform a natural point to hold funds through the return window before paying out.

## 4. Commission calculation *(implemented, checkout slice)*

- Effective commission rate resolution order: **seller-specific override → category default → platform default**. Exactly one of these always resolves; there is no code path that leaves the rate undefined. The platform default reads from `business-config` (`category: commission`), development default 15.00% (1500 basis points), flagged `is_placeholder: true` until replaced with a real approved rate (see [`DECISIONS.md`](DECISIONS.md)). Implemented today: `src/orders/commission.ts`'s `resolveCommission()` supports seller-specific override → platform default (the parameter for it exists); category-level defaults and the actual `seller.commission_rate_override` column are not built yet, since no seller has one to resolve.
- Commission applies to the item subtotal by default; shipping is excluded from commission by default (configurable per category in a later phase, not v1).
- Commission is computed and snapshotted on the `VendorOrder` row (`commission_rate_basis_points`, `commission_amount`) at creation time, **and** a corresponding `CommissionLedgerEntry` row is created in the same step *(implemented, financial-operations slice)* — `net_amount = subtotal_amount - commission_amount`, deliberately excluding shipping and tax, which are Bawi's own revenue/pass-through (Bawi is merchant of record and operates fulfillment itself - see [`DECISIONS.md`](DECISIONS.md)).
- All amounts are integer cents; rate is stored as a basis-points integer (e.g., 1500 = 15.00%) to avoid floating-point rate multiplication — the multiply-then-round step happens once, server-side, using a documented rounding rule (round-half-up to the nearest cent).

## 5. Payout cadence *(implemented, financial-operations slice)*

- Payout batches are an **explicit admin action** (`POST /admin/finance/payouts`), not a scheduled cron job — this project has no background job scheduler/worker process (see [`DECISIONS.md`](DECISIONS.md)); "scheduled batch job" as originally sketched is deferred until that infrastructure exists.
- A Transfer is never created until the seller's `CommissionLedgerEntry` is past its own `available_at` timestamp — set when the vendor_order is confirmed delivered, computed as `delivered_at + transfer_hold_days_snapshot` (the `business-config` transfer-hold period, `category: transfer_timing`, development default 7 days, `is_placeholder: true`, **snapshotted onto the ledger entry at capture time** so a later config change never retroactively alters an order already in flight — see [`DECISIONS.md`](DECISIONS.md)).
- A payout batch (`create-payout-batch` workflow) selects every ledger entry for the seller that is: (a) in the "available" bucket per `deriveLedgerBucket()` (past its hold window, not disputed), and (b) not already claimed by a prior `PayoutLineItem` (enforced by that column's **unique** constraint, not an application-level check — a re-run can never double-pay).
- A seller only receives a Transfer if their Stripe account currently reports `payouts_enabled` — checked immediately before creating the Transfer, not only inferred from onboarding history.
- The batch's Stripe idempotency key is derived from the exact sorted set of ledger-entry ids being paid, so a retried request against Stripe reuses the same Transfer rather than creating a second one.

## 6. Refunds and commission reversal *(implemented, financial-operations slice)*

- A return/refund reverses the commission proportionally: if 50% of a `VendorOrderItem`'s amount is refunded, 50% of its original commission is reversed via a negative `CommissionLedgerEntry` (`reason: refund_reversal`) — computed by the pure function `calculateRefund()` (`src/finance/refund-calculation.ts`).
- **Refund before payout:** the reversal simply nets against the seller's pending (not-yet-paid-out) balance — no money moves back from the seller. **Refund after payout:** the reversal creates a negative balance that offsets the seller's *next* payout batch.
- A `refund_reversal` entry's `available_at` is set to "now" (never a fresh hold period) — it nets immediately against whichever bucket its original entry currently sits in.
- Refund creation always computes the refund amount from stored order/item data server-side (capped at the item's own `line_total`) — never from a client-supplied amount.
- Approving a return also restocks inventory for restockable reasons (`incorrect`, `customer_remorse`) but not for unsellable ones (`damaged`, `defective`) — a v1 policy decision, see [`DECISIONS.md`](DECISIONS.md).
- A pre-pickup cancellation (`cancel-vendor-order` workflow, customer-initiated, allowed through `ready_for_pickup` while `business-config` `cancellation.cancellation_cutoff` is `picked_up`) produces a full refund, a full ledger reversal, and a full inventory restock, with an `OrderRefund` row that has no `return_request_id` (nullable, since there's no return request behind a cancellation).
- If a seller's account is closed/suspended with an outstanding negative balance, that is handled as an Admin-visible manual reconciliation case (not an automated clawback against the seller's bank account, which Stripe Connect does not support for this account type without an explicit debit reversal flow).

## 7. Webhook handling

All Stripe webhook events are handled by a single receiver in `apps/backend`, verified via Stripe's signing secret (`Stripe-Signature` header), then processed as follows:

- **Idempotency:** every incoming event's `event.id` is checked against a `processed_webhook_event` record before any side effect runs; if already processed, the handler returns success immediately without reapplying effects. This covers Stripe's at-least-once redelivery guarantee. The `apply-stripe-dispute-webhook` workflow uses the same claim-first pattern as `apply-stripe-account-updated-webhook`.
- **Events consumed (v1):**
  - `payment_intent.succeeded` **(implemented)** → `capture-checkout-payment` workflow: marks the order paid, splits it into per-vendor orders, finalizes the inventory deduction, clears the cart.
  - `payment_intent.payment_failed` **(implemented)** → `fail-checkout-payment` workflow: releases the inventory reservation, marks the order `payment_failed`, leaves the cart intact for retry.
  - `account.updated` **(implemented)** → update seller's `stripe_charges_enabled`/`stripe_payouts_enabled` (source of truth for onboarding/go-live status).
  - `charge.dispute.created` **(implemented)** → `apply-stripe-dispute-webhook` workflow: creates a `Dispute` row and freezes (`disputed_at`) every affected vendor_order's ledger entry — a dispute is against the whole marketplace-order charge, so it can span multiple vendor_orders.
  - `charge.dispute.closed` **(implemented)** → same workflow: marks the `Dispute` `won`/`lost`; a won dispute clears `disputed_at` on every affected entry, a lost dispute leaves it frozen permanently (surfaced for manual admin review — no auto-reversal ledger entry exists for a lost dispute in v1).
  - `charge.refunded` / `transfer.failed` / `transfer.reversed` **(not yet built)** — refunds and payout-transfer results are currently confirmed synchronously (the Stripe test-mode client returns success/failure directly from the API call), not via a follow-up webhook; a real production integration would also reconcile against these events.
- **Delivery reliability:** webhook processing failures are retried by Stripe automatically (per its redelivery schedule). There is no periodic automated reconciliation job yet (no background worker process exists in this project - see [`DECISIONS.md`](DECISIONS.md)); reconciliation today is a manual admin action.
- **Security:** webhook signature verification is mandatory before any parsing of the payload; requests failing verification are rejected with no processing and logged as a potential integrity issue.

## 8. What the platform never does

- Never stores a card number, CVC, or full card data in any of its own tables or logs.
- Never re-implements Stripe's KYC/identity verification.
- Never trusts a client-supplied amount, rate, or "paid" status for anything financial — every financial figure is computed or verified server-side from stored data or a Stripe API/webhook response.
- Never processes the same webhook event twice.
