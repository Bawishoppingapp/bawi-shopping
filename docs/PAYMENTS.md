# Bawi Shopping — Payments

## 1. Principles

- **Stripe Connect only.** No custom card storage, no alternate payment rails in v1.
- **Stripe is the only system that ever sees card data.** The storefront uses Stripe's Payment Element (Stripe.js); the backend only ever handles a `PaymentIntent` ID and its status — never a PAN, CVC, or raw card number.
- **The platform's Stripe account is merchant of record.** Customers pay the platform once per checkout; the platform then moves seller shares out via Stripe Connect Transfers.
- **All money math is integer cents.** No floating-point currency arithmetic anywhere in the codebase.
- **Every webhook handler is idempotent.** Stripe redelivers events; the same event ID must never apply its side effect twice.

## 2. Connect account type: Express

Sellers onboard as **Stripe Connect Express** accounts:

- Stripe hosts the onboarding UI (KYC, bank account) and the seller's payout dashboard — the platform never collects or stores bank details or identity documents.
- The platform retains control over branding/UX for everything except the onboarding and payout-dashboard steps Stripe hosts, which fits "professional, clean, platform-branded" while keeping compliance burden on Stripe.
- Alternative considered: **Standard** accounts (seller manages their own full Stripe dashboard/relationship — too much control ceded, weaker platform branding) and **Custom** accounts (fully white-labeled, but shifts significant compliance/liability onto the platform, unnecessary for v1). Express is the right default for an Amazon-Marketplace-style model where the platform, not the seller, is the customer-facing brand.

## 3. Payment pattern: Separate Charges and Transfers

For a cart spanning multiple sellers, the customer must pay once. Stripe Connect's **Separate Charges and Transfers** pattern fits this exactly:

1. At checkout, the backend creates one `PaymentIntent` **on the platform's own Stripe account** for the full cart total (all sellers combined).
2. The customer confirms payment once via Stripe Payment Element.
3. On successful capture, the checkout workflow splits the order into per-seller `VendorOrder`s (see [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md)) and records a `CommissionLedgerEntry` per vendor order.
4. Later, on the payout schedule, the platform creates a Stripe **Transfer** to each seller's connected Express account for their net amount (their subtotal minus their commission). Transfers are decoupled from the initial charge — they don't need to happen synchronously with checkout.

This is preferred over the alternative **Destination Charges** pattern (one `PaymentIntent` per seller, each with a `transfer_data.destination`) because destination charges require either multiple customer-facing PaymentIntents for a multi-seller cart (bad UX — the explicit thing this platform is designed to avoid) or complex on-behalf-of logic to fake a single charge across destinations. Separate Charges and Transfers naturally supports "one payment, N sellers" and gives the platform a natural point to hold funds through the return window before paying out.

## 4. Commission calculation

- Effective commission rate resolution order: **seller-specific override → category default → platform default**. Exactly one of these always resolves; there is no code path that leaves the rate undefined.
- Commission applies to the item subtotal by default; shipping is excluded from commission by default (configurable per category in a later phase, not v1).
- Commission is computed and recorded as a `CommissionLedgerEntry` at `VendorOrder` creation time (i.e., right after successful capture), not at payout time — so seller-facing "amount owed" figures are accurate immediately, even before the next payout cycle runs.
- All amounts are integer cents; rate is stored as a basis-points integer (e.g., 1500 = 15.00%) to avoid floating-point rate multiplication — the multiply-then-round step happens once, server-side, using a documented rounding rule (round-half-up to the nearest cent).

## 5. Payout cadence

- Payouts run on a scheduled batch job (`apps/workers`), not synchronously with checkout — default cadence: weekly rolling, configurable per environment.
- A payout batch selects all `CommissionLedgerEntry` rows for a seller that are: (a) tied to a captured, non-refunded (or already-adjusted) `VendorOrder`, (b) past the seller's/platform's return window (to reduce clawback risk on already-paid-out funds), and (c) not yet included in a prior `Payout`.
- A seller only receives a Transfer if their Stripe account currently reports `payouts_enabled` — checked immediately before creating the Transfer, not only inferred from onboarding history.
- Selected entries are marked "included in payout" atomically with `Payout`/`PayoutLineItem` creation, in the same transaction, so re-running the batch job can never double-select the same entries.

## 6. Refunds and commission reversal

- A return/refund reverses the commission proportionally: if 50% of a `VendorOrderItem`'s amount is refunded, 50% of its original commission is reversed via a negative `CommissionLedgerEntry`.
- **Refund before payout:** the reversal simply nets against the seller's pending (not-yet-paid-out) balance — no money moves back from the seller.
- **Refund after payout:** the reversal creates a negative balance that offsets the seller's *next* payout; if a seller's account is closed/suspended with an outstanding negative balance, that is handled as an Admin-visible manual reconciliation case (not an automated clawback against the seller's bank account, which Stripe Connect does not support for this account type without an explicit debit reversal flow — flagged as an open risk in [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md)).
- Refund creation always computes the refund amount from stored order/payment data server-side — never from a client-supplied amount.

## 7. Webhook handling

All Stripe webhook events are handled by a single receiver in `apps/backend`, verified via Stripe's signing secret (`Stripe-Signature` header), then processed as follows:

- **Idempotency:** every incoming event's `event.id` is checked against a `processed_webhook_event` record before any side effect runs; if already processed, the handler returns success immediately without reapplying effects. This covers Stripe's at-least-once redelivery guarantee.
- **Events consumed (v1):**
  - `payment_intent.succeeded` → resume checkout workflow to capture confirmation and trigger vendor-order splitting.
  - `payment_intent.payment_failed` → release inventory reservation, surface failure to customer.
  - `charge.refunded` → confirm refund completion, finalize commission reversal.
  - `account.updated` → update seller's `stripe_charges_enabled`/`stripe_payouts_enabled` (source of truth for onboarding/go-live status).
  - `transfer.failed` / `transfer.reversed` → mark payout `failed`, alert Admin, retry per backoff policy.
- **Delivery reliability:** webhook processing failures are retried by Stripe automatically (per its redelivery schedule); the platform also runs a periodic reconciliation job in `apps/workers` that cross-checks recent PaymentIntents/Transfers against local state to catch any webhook that was never delivered.
- **Security:** webhook signature verification is mandatory before any parsing of the payload; requests failing verification are rejected with no processing and logged as a potential integrity issue.

## 8. What the platform never does

- Never stores a card number, CVC, or full card data in any of its own tables or logs.
- Never re-implements Stripe's KYC/identity verification.
- Never trusts a client-supplied amount, rate, or "paid" status for anything financial — every financial figure is computed or verified server-side from stored data or a Stripe API/webhook response.
- Never processes the same webhook event twice.
