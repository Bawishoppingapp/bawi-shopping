# Bawi Shopping — Marketplace Flows

This document walks the four flows that define the marketplace: customer purchase, seller onboarding, multi-vendor payment/order-splitting, and returns/refunds. Each includes a sequence diagram and the failure/edge cases the implementation must handle.

## 1. Customer purchase flow (multi-vendor cart → single checkout)

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

```mermaid
sequenceDiagram
    participant S as Prospective seller
    participant SP as Seller portal
    participant API as Backend API
    participant ONB as Seller-onboarding module
    participant SEL as Seller module
    participant STRIPE as Stripe Connect
    participant A as Admin
    participant AP as Admin portal

    S->>SP: Submit application (brand info, business details)
    SP->>API: Create SellerApplication
    API->>ONB: Store application (status: submitted)
    A->>AP: Review application queue
    AP->>API: Approve or reject (with reason)
    alt Rejected
        API->>ONB: status = rejected, reason recorded
        API-->>S: Notification: rejected + reason, may re-apply
    else Approved
        API->>SEL: Create Seller (status: approved, not yet live)
        API->>ONB: status = approved
        API-->>S: Notification: approved, complete Stripe onboarding
        S->>SP: Start Stripe onboarding
        SP->>API: Request Stripe account link
        API->>STRIPE: Create Express connected account + account link
        STRIPE-->>API: Onboarding URL (single-use, short-lived)
        API-->>SP: Redirect seller to Stripe-hosted onboarding
        S->>STRIPE: Complete KYC / bank details (Stripe-hosted, never touches platform)
        STRIPE-->>API: Webhook: account.updated (charges_enabled, payouts_enabled)
        API->>SEL: Update onboarding status from webhook (source of truth)
        SEL-->>SP: "Go live" unlocked once charges_enabled AND payouts_enabled
        S->>SP: Publish first product
    end
```

### Edge cases

- **Seller closes the Stripe onboarding tab mid-flow:** they can resume; a new account link is generated (the old one is single-use/expired), and the platform never infers completion from client-side navigation — only from the `account.updated` webhook.
- **Stripe reports additional requirements later** (e.g., after a threshold is hit): the seller's "go live" status can flip back to blocked; this is handled the same way as initial onboarding — webhook-driven, not client-asserted.
- **Application resubmission after rejection:** allowed; a new `SellerApplication` links to the same prospective seller contact, previous rejection reason stays visible to admin reviewers.
- **Admin approves before Stripe details exist:** normal path — approval and Stripe onboarding are sequential, not simultaneous; a seller is `approved` (can access the portal, build a catalog in draft) before being `live` (can actually transact).

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
