# Bawi Shopping — Security

## 1. Threat model summary

The dominant risk in a multi-vendor marketplace is **cross-tenant data leakage** — one seller reading or modifying another seller's products, orders, or financials — followed by **payment integrity** (never trusting client-supplied money figures), **content integrity** (moderation bypass, fake reviews), and (once fulfillment is built) **buyer/seller identity leakage** — either party learning the other's real identity or contact details through an API response, UI, or notification that wasn't supposed to expose it. This document defines how each is prevented structurally, not just by convention.

## 2. Tenant isolation (seller-to-seller)

**Rule:** a seller-authenticated request can only ever touch rows where `vendor_id` equals that seller's own ID. This is enforced at the module service layer:

- Every custom/extended module's service methods accept the caller's authenticated context (never a client-supplied `vendor_id`/`seller_id` parameter as authoritative) and derive the scope filter from that context internally.
- Any API parameter that looks like it selects a seller (`?vendor_id=`, `?sellerId=`) is either ignored for seller-actor callers or, for Admin/Super Admin callers, explicitly permitted and logged.
- Negative authorization tests are mandatory for every seller-scoped endpoint: "seller A's token cannot read/write seller B's resource" is a required integration test before a module ships (see [`TESTING.md`](TESTING.md)).
- Denormalized `vendor_id` columns on child tables (variants, order items, etc. — see [`DATABASE.md`](DATABASE.md) §5) mean scoping doesn't depend on a join being present in every query path.

### Defense in depth (future hardening, not required for v1)

Postgres **Row-Level Security** policies keyed on a per-request session variable (`SET LOCAL app.current_vendor_id`) would add a second, database-enforced layer beneath the application-layer checks above. This is deferred because Medusa's MikroORM connection pooling makes per-request session variables non-trivial to wire correctly, and the application-layer enforcement plus mandatory negative tests are considered sufficient for v1. Tracked as a hardening item in [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md).

## 3. Authentication & session security

- Passwords hashed with a modern, salted algorithm (via Medusa's auth module); never logged, never returned in any API response.
- Sessions via HTTP-only, `Secure`, `SameSite=Lax` cookies scoped per app/domain — a storefront session cookie is not valid against the seller portal or admin API, and vice versa (separate actor types, see [`USER-ROLES.md`](USER-ROLES.md)).
- Password reset tokens: single-use, short-lived (≤1 hour), invalidated after use or password change.
- Login rate-limiting/backoff to blunt credential stuffing; generic error messages on failed login (no user-enumeration via distinct "no such email" vs "wrong password" responses).
- Admin portal: Super-Admin-only destructive actions (hard-deleting a seller, managing other admins) require an explicit confirmation step; step-up re-authentication for these actions is a recommended v1.1 hardening item, not required to ship v1.

## 4. Payment security

- No raw card data ever reaches platform servers — Stripe Payment Element (client-side) only; the backend only ever handles Stripe object IDs and statuses. See [`PAYMENTS.md`](PAYMENTS.md).
- Every financial figure (price, total, commission, refund amount) is computed or verified server-side from stored data; a client-supplied amount is never trusted for anything that moves money.
- Webhook signature verification (Stripe signing secret) is mandatory before any payload is parsed; unverifiable requests are rejected and logged.
- Every webhook handler is idempotent by Stripe event ID — see [`PAYMENTS.md`](PAYMENTS.md) §7.

## 5. Input validation & injection

- All database access goes through Medusa's query layer (MikroORM) with parameterized queries — no raw string-interpolated SQL, including in the Postgres full-text search adapter.
- File uploads (product images) are validated server-side by content/MIME sniffing and size limits, not by trusting the client-supplied filename/extension; stored in object storage under generated keys, never executed or served from a path that could be interpreted as code.
- User-generated text (reviews, seller descriptions) is escaped/sanitized on render to prevent stored XSS; rich-text fields, if any, use an allowlist-based sanitizer rather than rendering raw HTML.
- All external IDs used in URLs (order IDs, product IDs) are non-sequential (ULID/UUID) to avoid enumeration attacks.

## 6. Audit logging

**Implemented:** the `audit-log` custom module (`apps/backend/src/modules/audit-log`) exists and is in real use — approving or rejecting a `SellerApplication` writes an entry via its `record()` method (`apps/backend/src/api/admin/seller-applications/[id]/{approve,reject}/route.ts`). Verified by an integration test asserting the recorded `actor_id` is the *real* authenticated admin's id, never a value the client attempted to supply in the request body.

- Actions that must be audit-logged (non-exhaustive, enforced list): seller application approval/rejection (done), seller status changes (approve/suspend/reject/hard-delete), product publish/unpublish by admin override, commission rule changes, refund creation, payout creation/failure, admin/seller-user role changes, moderation decisions, admin reads of customer/seller data for support purposes.
- The actor id recorded is always read from `req.auth_context.actor_id` (the session the `authenticate(...)` middleware already verified) — never from any client-supplied field, even one plausibly named `actor_id` or `adminId` in the request body.
- Audit entries are written in the same request as the action itself — if the audit write fails, the action fails too, for every item in the list above. This is a deliberate exception to "don't add error handling for things that can't happen": an audit write can fail (DB blip, constraint issue) and the correctness requirement is that the two never diverge. Today this is a plain sequential `await` in the route handler, not a formal DB transaction wrapping both writes — a genuine gap for true atomicity, tracked as a residual risk in `docs/IMPLEMENTATION-PLAN.md` pending a workflow-based rewrite.
- `audit_log` is append-only **by convention** so far: no application code path issues an `UPDATE` or `DELETE` against it, but the database role the application connects as has not yet been restricted to `INSERT`/`SELECT` only — that DB-level grant restriction remains a documented future hardening step, not yet applied.
- Audit log read access is itself scoped by role (see [`USER-ROLES.md`](USER-ROLES.md) §3) — a seller sees only entries about their own account; only Super Admin has unfiltered access. **Not yet built:** there is no admin-facing UI or API to browse audit log entries yet (verified so far only via direct database queries in tests) — a future slice.

## 7. Moderation & content integrity

- Reviews require a verified purchase (a delivered `vendor_order_item` owned by the reviewing customer) — enforced server-side, not inferred from client state.
- New products/reviews enter the moderation queue per the policy defined per content type in [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md); a rejected item re-entering the queue on any subsequent edit is required, not optional — a bug here would let rejected content silently reappear.

## 8. Secrets & configuration

- Stripe API keys, database credentials, and any provider secrets are held in environment configuration per environment (local/staging/production), never committed to the repository, never logged.
- Stripe Connect account-linking URLs are single-use and short-lived by Stripe's design; the platform never caches or logs them.
- Separate Stripe API key pairs (test/live) per environment; production always uses live keys, staging/local always use test keys — no environment is permitted to hold both.

## 9. Dependency & supply chain

- New dependencies are added deliberately (per the "no unnecessary libraries" rule in [`CLAUDE.md`](../CLAUDE.md)) and reviewed for maintenance status before adoption.
- Automated dependency vulnerability scanning runs in CI (tooling choice finalized in [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md)); no dependency updates are auto-merged without CI passing.

## 10. Data privacy

- Customer PII (addresses, order history) is readable only by that customer and by Admin for support purposes (logged). Sellers see only the shipping information needed to fulfill their own `VendorOrder`s — never a customer's full account/order history across other sellers.
- Object storage for product images is not used for any customer PII — product images only.
- No data is sent to any third party beyond what's required for the transaction (Stripe for payment, email provider for transactional notifications) — no analytics/ad-tech data sharing decisions are made in this document; if introduced later, they require a privacy review.

## 11. Identity separation & private fulfillment *(decided, not yet built)*

See [`DECISIONS.md`](DECISIONS.md) for the full requirement and [`PRD.md`](PRD.md) §9.23 for the feature spec. Captured here now, ahead of the fulfillment slice, because it's a rule the current product-catalog work must already respect even though the fulfillment mechanics aren't built yet:

- **Vendor and customer identities are never exposed to each other**, in either direction, through any API response, UI, or notification. This is CLAUDE.md rule #12 — a stronger, bidirectional version of the existing "seller identity must not be publicly exposed to customers" rule already in effect for products (§9.6 in `PRD.md`).
- **Bawi Shopping is a private-vendor-fulfillment marketplace**: Bawi controls product listings, pricing, customer service, tracking, returns, receipts, and vendor communication. Vendors never receive customer names, contact details, payment information, or delivery addresses; customers never receive vendor identities or pickup locations.
- **Per-role information scoping once orders exist:**
  - **Vendors** receive, per order, only product, size, quantity, a preparation deadline, and pickup instructions.
  - **Couriers** receive only the pickup/delivery information for their one assigned delivery.
  - **Seller-facing APIs must never return customer delivery information** — build the response shape to exclude it structurally, don't filter it out after the fact (same discipline as vendor-scoped `WHERE` filters in §2).
  - **Vendor IDs stay server-side and private** — never present in a client-facing (storefront or seller-portal-to-customer) response.
- **All fulfillment communication, tracking, returns, and packaging are Bawi-controlled.** There is no direct seller-to-customer or customer-to-seller channel, now or in any currently-planned future slice — a "let sellers message customers directly" feature would need its own explicit re-decision, not an incremental addition to fulfillment. Returns are handled through Bawi, never by giving a customer a vendor's address directly.
- **Planned controls once delivery is built:** three distinct order-scoped temporary codes — fulfillment, pickup, and tracking (not one shared code); pickup codes are single-use and **expire on collection** (consumed the instant pickup is confirmed, not merely time-limited — a stale or reused code must be rejected, not just discouraged in the UI); all three codes unguessable (same "non-sequential ID" principle as §5); a `courier` role (see [`USER-ROLES.md`](USER-ROLES.md) §2.7) scoped strictly to its one assigned handoff, unable to read customer/seller PII or order financials beyond that; **all issuance/consumption of these codes and any status change is audit-logged** (CLAUDE.md rule #6).
- **Architecture must not assume one pickup model.** The design must support either direct courier pickup at the vendor's location or a future Bawi-operated sorting hub — pickup location is a resolvable per-order value, not a hard-coded assumption. See [`ARCHITECTURE.md`](ARCHITECTURE.md) §11.
- **Product-catalog-slice implication today:** the private `vendor_sku` and the permanent `product_code` (see [`DATABASE.md`](DATABASE.md)) both exist partly to support this — a product's permanent code is safe to expose in a fulfillment-code/QR context later without also exposing the seller's own private SKU or the seller's identity.
- **Merchant-of-record: resolved.** Bawi Shopping is the merchant of record for every transaction — Bawi has legal authority over returns, is liable for a lost/damaged parcel as the customer-facing party, and its name (not a vendor's) appears on receipts/tax documents. See [`DECISIONS.md`](DECISIONS.md) for the full decision and [`PAYMENTS.md`](PAYMENTS.md) for the resulting payment architecture (Separate Charges and Transfers, Stripe Express connected accounts, no Destination Charges).

## 12. Payments & business-configuration privacy *(resolved decision — see `docs/DECISIONS.md`)*

- **No bank information, identity documents, tax IDs, or full Stripe account objects are ever stored in Bawi's own database.** The `seller` table holds only `stripe_account_id` (an opaque reference) plus `stripe_charges_enabled`/`stripe_payouts_enabled`/`stripe_details_submitted` booleans, derived from `account.updated` webhooks — never the raw webhook payload. Stripe alone holds KYC/financial-instrument data.
- **Product brand and vendor identity are separate concepts.** A normal product brand may be displayed publicly same as any product attribute. A vendor's own store name or vendor-owned brand is private by default and may only be shown publicly once Bawi admin explicitly approves it (`seller.public_brand_display_approved`, admin-controlled, defaults `false`) — until approved, it carries the same privacy tier as the vendor's identity generally (§2, §11).
- **Never expose** `vendor_id`, a seller's Stripe connected-account ID, private SKUs, pickup addresses, seller emails, or seller phone numbers through the storefront — the Stripe account ID is treated with the same sensitivity as `vendor_id` itself, not as a lesser-tier identifier.
- **Seller-facing APIs must never return customer names, delivery addresses, phone numbers, emails, or payment information** — reaffirms §11, explicitly extended to cover payment information as new payment surfaces are built.
- **Courier access is scoped to the courier's one assigned delivery and every access is logged** (mechanics land with Phase 6 — see [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md)).
- **Business-configuration values** (commission rate, transfer-hold period, return window, etc. — see [`DECISIONS.md`](DECISIONS.md)) are admin-editable and every write is audit-logged (actor, before/after value), same discipline as §6. No config value that would enable real money movement, a real communication, or a real courier booking takes effect unless its corresponding feature flag (`live_payments_enabled`, `real_transfers_enabled`, etc. — all default `false`) is explicitly enabled; none of these flags is ever set to `true` by a migration, seed script, or environment-variable default.

## 13. Cart privacy *(implemented — multi-vendor shopping cart)*

- **Customers never see how many vendors are represented in a cart** — the storefront cart response is one unified Bawi cart (subtotal, items, warnings); there is no vendor count, vendor grouping, or per-vendor subtotal anywhere in the response shape. Vendor ownership per line item is tracked only in the line item's internal `metadata.vendor_id` and is never read back out into any response — see `apps/backend/src/cart/cart-response.ts`.
- **Storefront cart responses never include** `vendor_id`, seller id, seller Stripe account id, private SKU, pickup location, or seller contact details — the same tier of sensitivity as §12, verified by an integration test that serializes a full cart response and asserts none of these strings appear.
- **A cart line item's `brand` field follows the same `public_brand_display_approved` gate as everywhere else** (`resolvePublicBrand()`) — a vendor's own store name never appears unless Bawi has approved it for public display, even though the cart is composed from multiple sellers' products at once.
- **Seller and admin actor types have no route that can reach customer cart data.** `/store/cart*` accepts only an unauthenticated guest (identified by an opaque cart-id header) or an `authenticate("customer", ...)`-verified session — a `seller_user` or `user` (admin) bearer token is never treated as authorized here.
- **The guest cart identifier is Medusa's own cart id** (already a non-sequential ULID, same principle as §5) — never a customer email, vendor id, or other predictable value. It's stored in an httpOnly, `Secure` (in production), `SameSite=Lax` cookie owned by the storefront app, forwarded to the backend as a header — the Medusa backend itself never sets this cookie, keeping cookie ownership consistent with how the customer session token already works.
- **Every cart mutation re-derives price, inventory, and approval status server-side** (`resolveCartVariant()`) — a client-supplied price, vendor id, or availability figure is never accepted for anything, verified by an integration test that submits both and asserts they're ignored.
