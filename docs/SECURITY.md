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
- **All fulfillment communication, tracking, returns, and packaging are Bawi-controlled.** There is no direct seller-to-customer or customer-to-seller channel, now or in any currently-planned future slice — a "let sellers message customers directly" feature would need its own explicit re-decision, not an incremental addition to fulfillment.
- **Planned controls once delivery is built:** single-use, expiring pickup QR codes (a stale or reused code must be rejected, not just discouraged in the UI); unguessable temporary fulfillment codes (same "non-sequential ID" principle as §5); a `courier` role (see [`USER-ROLES.md`](USER-ROLES.md) §2.7) scoped strictly to its assigned handoff, unable to read customer/seller PII or order financials beyond that.
- **Product-catalog-slice implication today:** the private `vendor_sku` and the permanent `product_code` (see [`DATABASE.md`](DATABASE.md)) both exist partly to support this — a product's permanent code is safe to expose in a fulfillment-code/QR context later without also exposing the seller's own private SKU or the seller's identity.
- **Merchant-of-record is an explicitly open legal/business decision.** It has direct security/compliance implications here (who has legal authority over a return, who is liable for a lost/damaged parcel, whose name appears on receipts/tax documents) — none of those questions are answered by this document, and nothing in the current implementation should assume an answer either way.
