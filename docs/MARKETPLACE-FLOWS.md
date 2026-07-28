# Bawi Shopping — Marketplace Flows

This document walks the four flows that define the marketplace: customer purchase, seller onboarding, multi-vendor payment/order-splitting, and returns/refunds. Each includes a sequence diagram and the failure/edge cases the implementation must handle.

**Note on fulfillment/returns and identity separation:** the shipping and returns flows below predate the private-fulfillment decision in [`DECISIONS.md`](DECISIONS.md) and don't yet reflect it — they'll need a redesign pass once the fulfillment slice is actually built: separate temporary fulfillment/pickup/tracking codes per order (not one shared code), pickup codes single-use and expiring on collection, vendors seeing only product/size/quantity/prep-deadline/pickup-instructions per order, couriers scoped to their one assigned delivery, no direct seller↔customer shipping/tracking contact, and a pickup-location model that isn't hard-coded to "at the vendor's address" (must also support a future Bawi sorting hub — see `docs/ARCHITECTURE.md` §11). Until then, treat any step below that implies direct seller-to-customer shipping/tracking contact as provisional, not as contradicting the decided model.

## 1. Customer purchase flow (multi-vendor cart → single checkout)

**Cart and checkout are both implemented.** The diagram below is now the real end-to-end flow (`apps/backend/src/cart/`, `apps/backend/src/workflows/{start,capture,fail}-checkout*.ts`, custom `/store/cart/*` and `/store/checkout`/`/store/orders*` routes - see `docs/DECISIONS.md`). A few details worth calling out against the diagram as drawn: the availability check on add-to-cart is a **hard** rejection (quantity above live inventory or the configurable per-line-item maximum is refused outright), not the "soft-check" implied below; checkout's own re-validation at submit time reuses the exact same `resolveCartVariants()`/`refreshAndShapeCart()` re-resolution the cart already applies on every read, not a separate mechanism; an item that becomes unavailable *after* being added is never silently dropped from the cart - it stays, flagged, with `checkout_blocked: true` on the cart, until the customer resolves it; there is no guest checkout in v1 (`marketplace_order.customer_id` is `NOT NULL` by design - a guest must log in/register first, which already triggers the existing cart-merge flow); the "shipping-option selection" a customer sees is a single calculated flat-fee-or-free amount (no multi-carrier picker yet - no shipping_option module exists, see `docs/DECISIONS.md`); and vendor-order splitting only happens *after* payment capture succeeds, never before, so a seller's dashboard never shows an order that might not end up paid.

```mermaid
sequenceDiagram
    participant C as Customer
    participant SF as Storefront
    participant API as Backend API
    participant CART as Cart module
    participant INV as Inventory module
    participant PRICE as Pricing module
    participant CHK as Checkout workflow
    participant PAY as Payment module (Stripe)
    participant VOS as Vendor-order splitting
    participant ORD as Order module
    participant NOTIF as Notifications

    C->>SF: Browse, search, add items from Seller A and Seller B
    SF->>API: Add line items to cart
    API->>CART: Upsert line items
    CART->>INV: Soft-check availability
    C->>SF: Proceed to checkout
    SF->>API: Submit shipping address + payment method
    API->>CHK: Start checkout(cartId, idempotencyKey)
    CHK->>PRICE: Re-price every line item server-side
    CHK->>INV: Reserve inventory per seller (hard check)
    alt Any item unavailable
        CHK-->>SF: 409 — item(s) unavailable, cart updated
        SF-->>C: Prompt to remove/adjust unavailable item
    else All available
        CHK->>PAY: Create PaymentIntent for full cart total (platform account)
        PAY-->>CHK: PaymentIntent requires confirmation
        CHK-->>SF: Client secret
        SF->>C: Confirm payment (Stripe Payment Element)
        C->>PAY: Confirm (Stripe.js, card data never touches backend)
        PAY-->>API: Webhook: payment_intent.succeeded (idempotency-checked)
        API->>CHK: Resume checkout on capture confirmation
        CHK->>VOS: Split cart into per-vendor orders
        VOS->>ORD: Create Order (group) + one VendorOrder per seller
        VOS->>INV: Confirm reservations → decrement
        CHK->>NOTIF: Queue order confirmation email
        API-->>SF: Order confirmation (order + vendor sub-orders)
        SF-->>C: Confirmation page
    end
```

### Edge cases

- **Partial availability at submit time:** checkout fails atomically for the whole cart before any payment is created; the customer adjusts and resubmits. No partial charge is ever created.
- **Payment confirmation abandoned:** an uncaptured PaymentIntent expires; reserved inventory is released after a timeout so it isn't held indefinitely against an abandoned checkout.
- **Duplicate submission (double-click, network retry):** the checkout workflow is keyed by a client-generated idempotency key; a retried submission with the same key returns the existing result rather than creating a second order/charge.
- **Price changed since add-to-cart:** checkout always re-prices from the database; if the price moved, the customer is shown the new total before confirming payment (never silently charged a different amount than shown).
- **One seller in the cart is suspended between add-to-cart and checkout:** that seller's line items are blocked at the hard-availability-check step, same as an out-of-stock item.

## 2. Seller onboarding flow

**Implemented so far:** application submission → admin review → approval/rejection → seller account activation → seller login → Stripe Connect account linking (§2.2). An approved, activated seller can log in, build a catalog, and connect a Stripe Express account to become "live" for real transactions once test-mode Stripe is later graduated to live mode (see `docs/DECISIONS.md`).

### 2.1 Application, review, and activation (implemented)

```mermaid
sequenceDiagram
    participant S as Prospective seller
    participant SP as Seller portal (public pages)
    participant API as Backend API
    participant APPL as seller-application module
    participant SEL as seller module
    participant AUDIT as audit-log module
    participant A as Admin
    participant AP as Admin portal

    S->>SP: Fill out /apply (business + contact info, categories, terms)
    SP->>API: POST /seller-applications
    API->>APPL: Validate (Zod), reject if a pending application already exists for this email
    APPL-->>API: Created (status: submitted, submitted_at set)
    API-->>SP: Application id + status
    SP-->>S: Confirmation page (/apply/:id) with status wording

    A->>AP: Log in (Medusa native `user` actor type), open /applications
    AP->>API: GET /admin/seller-applications?status=submitted
    A->>AP: Open one application, click Approve or Reject

    alt Reject
        AP->>API: POST /admin/seller-applications/:id/reject { reason }
        API->>APPL: status = rejected, rejection_reason stored (private)
        API->>AUDIT: record("seller_application.rejected", actor = real admin id)
        API-->>AP: Updated application (reason NOT exposed via any public endpoint)
    else Approve
        AP->>API: POST /admin/seller-applications/:id/approve
        API->>APPL: Idempotency check - already approved? return existing seller, no-op
        API->>SEL: Create Seller (status: approved) + SellerUser (email set, auth_identity_id null, activation_token issued)
        API->>APPL: status = approved, seller_id set, reviewed_by = real admin id
        API->>AUDIT: record("seller_application.approved", actor = real admin id, vendor_id = seller.id)
        API-->>AP: Seller + activation link (shown to admin - see note below)
    end

    S->>SP: Open /activate?token=... , set a password
    SP->>API: POST /seller-activation/complete { token, password }
    API->>SEL: Validate token (exists, unexpired, unused) - creates auth_identity, links app_metadata.seller_user_id, clears token
    API-->>SP: Success
    S->>SP: Log in at /login with business email + new password
    SP->>API: POST /auth/seller_user/emailpass
    API-->>SP: Session token -> HTTP-only cookie
    SP-->>S: Seller dashboard (own vendor name, resolved server-side via GET /seller/me)
```

**Note on the activation link:** there is no notification/email service yet (see `docs/PRD.md` §8 deferred features), so the approve action returns the activation link directly in the admin UI response for the admin to relay manually. This is a deliberate, documented stand-in — see `docs/DECISIONS.md` — not the intended production delivery mechanism (which will be an email once the Notifications module ships).

### Edge cases (implemented flow)

- **Duplicate submission:** a new application is rejected (409) if the same `business_email` already has a `submitted` or `under_review` application; resubmission after `rejected`/`withdrawn` is allowed (those are terminal, so no conflict).
- **Repeated approval (double-click, retry):** idempotent — the second call detects `seller_id` is already set and returns the existing seller/seller_user without creating duplicates or writing a second audit entry.
- **Invalid status transition:** approving a `rejected`/`withdrawn`/`draft` application (or rejecting an already-rejected one past the idempotent no-op case) is rejected with a 422, per the state machine in `apps/backend/src/modules/seller-application/state-machine.ts`.
- **Rejected or still-pending applicant tries to log into the seller portal:** fails with a generic "Invalid email or password" — there is no `seller_user`/`auth_identity` at all until an application is actually approved, so there's nothing to authenticate against (verified by an integration test and an E2E test).
- **Activation token reuse:** a second `POST /seller-activation/complete` with an already-consumed token is rejected (the token is cleared on first successful use).
- **Concurrent approval requests (residual risk):** the idempotency check has a narrow TOCTOU window under true concurrent requests (not just sequential retries) — see `docs/IMPLEMENTATION-PLAN.md` risks.

### 2.2 Stripe Connect account linking (implemented)

Layers on **after** activation: an activated seller can log in and manage a draft catalog, but isn't "live" for real transactions until Stripe onboarding completes. The seller-authenticated `POST /seller/stripe/onboarding-link` creates (or reuses) a Stripe Express account and returns a single-use, short-lived Account Link URL; the seller portal redirects there. `account.updated` webhooks (verified by Stripe signature, deduplicated via `processed_webhook_event`) are the onboarding-status source of truth — never inferred from client navigation or a "seller says they finished" claim. See `docs/PAYMENTS.md` §2, `docs/DECISIONS.md`.

```mermaid
sequenceDiagram
    participant S as Activated seller
    participant SP as Seller portal
    participant API as Backend API
    participant SEL as seller module
    participant STRIPE as Stripe
    participant AUDIT as audit-log module

    S->>SP: Open dashboard, click "Connect payouts"
    SP->>API: POST /seller/stripe/onboarding-link
    API->>SEL: Reuse existing stripe_account_id, or create a new Express account
    API->>STRIPE: accounts.create (if none exists yet)
    API->>STRIPE: accountLinks.create (return_url, refresh_url)
    API->>AUDIT: record("seller.stripe_onboarding_link_created")
    API-->>SP: Account Link URL
    SP-->>S: Redirect to Stripe-hosted onboarding
    S->>STRIPE: Complete KYC + bank details (never touches Bawi's servers)
    STRIPE-->>API: Webhook: account.updated (signature-verified, idempotency-checked)
    API->>SEL: Update stripe_charges_enabled / stripe_payouts_enabled / stripe_details_submitted
    API->>AUDIT: record("seller.stripe_status_updated")
    STRIPE-->>S: Redirect back to seller portal's return_url
    S->>SP: Dashboard now shows "Payouts: live" (or "pending" if not yet complete)
```

## 3. Multi-vendor payment and order-splitting flow

This is the mechanically hardest part of the platform: **one customer payment must fund N independent sellers, net of platform commission, without requiring the customer to pay N times.**

### Chosen pattern: Separate Charges and Transfers (Stripe Connect)

The platform's own Stripe account is the merchant of record for the single customer charge. After capture, the platform creates one Stripe **Transfer** per seller represented in the order, for that seller's net amount (their share of the order minus their commission), to their connected Express account. This is the standard Stripe Connect pattern for "one customer payment, multiple destination sellers," and it keeps the customer experience to a single payment while still giving each seller their own funds flow and Stripe dashboard.

Full mechanics, webhook idempotency, and failure handling are in [`PAYMENTS.md`](PAYMENTS.md). The order-splitting side:

```mermaid
sequenceDiagram
    participant CHK as Checkout workflow
    participant PAY as Payment module
    participant COMM as Commission module
    participant VOS as Vendor-order splitting
    participant ORD as Order module
    participant PO as Payout module (later, async)
    participant STRIPE as Stripe

    CHK->>PAY: Capture confirmed (webhook: payment_intent.succeeded)
    CHK->>VOS: Split cart lines by vendor_id
    VOS->>ORD: Create Order (group)
    loop for each seller present in cart
        VOS->>ORD: Create VendorOrder (seller X) with its line items
        VOS->>COMM: Resolve commission rate for seller X (override > category > default)
        COMM->>COMM: Record CommissionLedgerEntry (order total × rate, integer cents)
    end
    Note over PO,STRIPE: Payout is a separate, later, batched process — not part of checkout
    PO->>STRIPE: Create Transfer(s) to each seller's connected account, net of commission
```

Payout timing is deliberately decoupled from checkout: checkout only needs to authorize/capture the customer's single payment and record what each seller is owed (the commission ledger). Actually moving money to sellers happens on the payout schedule (see [`PAYMENTS.md`](PAYMENTS.md) §"Payout cadence"), which allows the platform to hold funds through the return window before paying out, reducing clawback risk.

### Edge cases

- **One seller's items are refunded after payout has already occurred for that order:** the commission reversal and any Transfer-reversal/offset against a future payout are handled explicitly — see [`PAYMENTS.md`](PAYMENTS.md) §"Refunds after payout."
- **A `VendorOrder` fails to create after capture succeeded** (should be effectively impossible given pre-capture reservation, but must be handled): the workflow retries the split step; if it cannot succeed, the event is surfaced to Admin as a manual-intervention case rather than silently losing the seller's portion of a captured payment.
- **Order contains only one seller:** the same code path runs (one `VendorOrder`, one commission entry) — there is no special-cased "single seller" shortcut, so behavior stays consistent as sellers are added or removed from a cart during checkout iteration.

## 4. Returns and refunds flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant SF as Storefront
    participant API as Backend API
    participant RET as Returns module
    participant S as Seller
    participant SP as Seller portal
    participant PAY as Payment module
    participant COMM as Commission module
    participant STRIPE as Stripe
    participant NOTIF as Notifications

    C->>SF: Request return on a delivered vendor_order_item
    SF->>API: Create ReturnRequest
    API->>RET: Validate return window, item status
    RET-->>S: Notify seller (or admin if escalated) of pending return
    S->>SP: Approve or deny (with reason)
    alt Denied
        API->>RET: status = denied
        API->>NOTIF: Notify customer with reason
    else Approved
        API->>RET: status = approved
        API->>PAY: Create refund for the original PaymentIntent (bounded by item amount)
        PAY->>STRIPE: Refund
        STRIPE-->>API: Webhook: charge.refunded (idempotency-checked)
        API->>COMM: Record proportional CommissionLedgerEntry reversal
        API->>RET: status = refunded
        API->>NOTIF: Notify customer refund complete
    end
```

### Edge cases

- **Return window expired:** request is rejected server-side at creation time with a clear message; window length is configurable (platform default, optionally overridden per seller/category — decision tracked in [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md)).
- **Refund requested twice for the same item:** second request is rejected idempotently once a refund exists/is in-flight for that item.
- **Stripe refund fails** (e.g., insufficient available balance on the platform account): the return stays in an `approved-pending-refund` state, surfaced to Admin, rather than being marked `refunded` before Stripe confirms it.
- **Escalation:** if a seller doesn't act within an SLA window, Admin can approve/deny on the seller's behalf; this path is explicitly logged as an admin override in the audit log, distinct from a normal seller decision.
