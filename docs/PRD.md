# Bawi Shopping — Product Requirements Document

## 1. Vision

Bawi Shopping is a multi-vendor fashion marketplace where independent clothing brands and boutiques reach customers through one clean, modern storefront, and the platform earns a commission on every sale it facilitates. The product experience should feel like a curated fashion destination, not a listings dump — closer to a well-edited fashion retailer than a generic classifieds site, while the underlying mechanics (seller onboarding, multi-vendor cart, split payments, fulfillment, returns) work like Amazon Marketplace.

## 2. Goals

- Let an unlimited number of approved sellers list and sell physical clothing/accessories independently.
- Let a customer buy from several sellers in a single checkout and a single payment.
- Collect a commission automatically on every order, with transparent seller payouts via Stripe Connect.
- Give sellers full control of their own catalog, inventory, and fulfillment without ever exposing another seller's data.
- Ship a first release that is small, correct, and secure rather than broad and shallow.

## 3. Non-goals (for this document)

- No international launch (US only for v1).
- No marketplaces for services, digital goods, or non-fashion categories.
- No custom payment rails — Stripe Connect only.
- No microservices — see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 4. Personas

Full definitions live in [`USER-ROLES.md`](USER-ROLES.md). Summary:

- **Guest** — anonymous shopper browsing the storefront.
- **Customer** — registered shopper who can check out, track orders, request returns, leave reviews.
- **Seller Owner** — the accountable owner of a seller account (brand/boutique); completes Stripe Connect onboarding.
- **Seller Staff** — additional users under a seller account with scoped permissions (e.g., catalog editor, order fulfiller).
- **Admin (platform staff)** — approves sellers, moderates content, handles escalations, views platform-wide reporting.
- **Super Admin** — admin with the ability to manage other admins and platform-level configuration.
- **Courier** *(role decided, not yet built — see §9.23)* — limited-access role that completes pickup/delivery handoffs without seeing customer or seller identity beyond what a handoff requires.

## 5. Business model

- Sellers list products for free; the platform takes a **commission percentage** (configurable per seller or per category, with a platform default) on the item total of every completed order.
- Shipping is charged to the customer and passed through to the seller (commission may or may not apply to shipping — configurable, default: commission on item subtotal only).
- Refunds reverse the commission proportionally to the refunded amount.
- Full commission and payout mechanics are in [`PAYMENTS.md`](PAYMENTS.md).

## 6. Scope assumptions carried into this design

- Launch market: United States only (USD, US tax/shipping rules).
- Sellers: independent fashion brands and boutiques, approved before they can sell.
- Products: physical clothing and fashion accessories only (no services, no digital goods).
- Sellers own their own inventory and fulfillment — the platform does not hold stock.
- One cart can span multiple sellers; checkout produces one payment and multiple per-vendor orders.
- Platform commission on every transaction.
- Stripe Connect for seller onboarding and payouts.
- Medusa + PostgreSQL backend; Next.js + TypeScript storefront, seller portal, admin portal; monorepo.
- Object storage for product images.
- Search starts on Postgres, must be swappable to Algolia later without a rewrite.

## 7. First-release feature list

In scope for v1 (detailed specs in §9):

- Email/password authentication for customers, sellers, and admins; role-based access control.
- Customer registration, profile, addresses, order history.
- Seller application, review/approval, Stripe Connect onboarding.
- Catalog: categories, products, variants (size/color), images, inventory counts, pricing.
- Postgres-backed keyword search with filters (category, price, size, color).
- Multi-vendor cart and single-payment checkout.
- Stripe Connect payments with automatic commission split and per-vendor payout ledger.
- Order creation with automatic vendor-order splitting; per-vendor order management for sellers.
- Shipping: seller-entered shipping options/rates, tracking number capture, shipment status.
- Customer-initiated returns and refunds, seller/admin approval, refund-triggered commission reversal.
- Verified-purchase product reviews with basic moderation.
- Content moderation queue for products and reviews (admin).
- Transactional notifications (order, shipment, return, payout events) via email.
- Basic seller and platform reporting (sales, orders, payouts, commission).
- Audit logs for all sensitive actions.

## 8. Deferred features (explicitly out of scope for v1)

- International sellers, currencies, or shipping.
- Algolia integration itself (only the abstraction/interface ships now — see [`ARCHITECTURE.md`](ARCHITECTURE.md)).
- Seller subscription tiers / paid placement / advertising.
- Multi-currency storefront (currency stays USD-only for v1; multi-*language* is decided and its i18n foundation is built this slice — see §9.24).
- SMS or push notifications (email only for v1).
- Live chat / messaging between customer and seller (and, once built, this stays intermediated by Bawi even for fulfillment-related contact — see §9.23; there is no v1 or later plan for a direct customer↔seller channel).
- Seller-to-seller marketplace features (bundles across sellers, cross-seller promotions).
- Gift cards, store credit, loyalty points.
- Marketplace financing / seller cash advances.
- Advanced fraud detection beyond Stripe Radar defaults.
- Mobile native apps (responsive web only).
- Wishlists, saved-for-later, size-recommendation/AI styling features.
- Custom RLS-based database isolation (documented as a future hardening option in [`SECURITY.md`](SECURITY.md), not required for v1).
- **Delivery/fulfillment execution, temporary fulfillment codes, single-use expiring pickup QR codes, and the `courier` role/portal** — the private-fulfillment *model* is decided (§9.23), the mechanics are not built.
- **The full translation system** (seller/AI translation submission UI, Bawi approval workflow, locale-aware storefront rendering) — the language list and storage model are decided (§9.24), the system is not built. The product-catalog slice only reserves the schema shape (translations in a separate table, never inline columns).
- ~~**Merchant-of-record** is an explicitly open legal/business decision~~ — **resolved: Bawi Shopping is the merchant of record.** See [`DECISIONS.md`](DECISIONS.md).

## 9. Feature specifications

Each feature below maps to one or more of the required domain modules. For every feature: user story, acceptance criteria, data ownership, authorization rules, validation requirements, failure states, security risks, and the three test levels required before it ships. Full authorization details are cross-referenced to [`USER-ROLES.md`](USER-ROLES.md); full payment mechanics to [`PAYMENTS.md`](PAYMENTS.md); full schema to [`DATABASE.md`](DATABASE.md).

---

### 9.1 Authentication

**Domain module:** `authentication`

- **User story:** As a customer, seller, or admin, I want to register and log in securely so that only I can access my account and role-appropriate features.
- **Acceptance criteria:**
  - Email/password registration and login for all three actor types (customer, seller user, admin user), each with its own actor namespace.
  - Passwords hashed with a modern algorithm (argon2/bcrypt via Medusa's auth module); never stored or logged in plaintext.
  - Session via HTTP-only, secure, same-site cookies (or short-lived JWT + refresh token) per app.
  - Password reset via emailed, single-use, time-limited token.
  - Account lockout / backoff after repeated failed login attempts.
- **Data ownership:** `auth_identity`, `provider_identity` tables (Medusa auth module). No `vendor_id` — authentication identities are global, but each identity links to exactly one actor record (customer, seller user, or admin user).
- **Authorization rules:** Unauthenticated users may register/login only. No cross-actor-type login (a seller user cannot use their credentials on the admin portal login).
- **Validation requirements:** Email format and uniqueness per actor type; password minimum strength; reset tokens single-use and expiring (≤1 hour).
- **Failure states:** Invalid credentials → generic error (no user enumeration); expired/used reset token → explicit re-request prompt; lockout → clear retry-after messaging.
- **Security risks:** Credential stuffing, user enumeration via distinct error messages, session fixation, reset-token leakage via referrer/logs.
- **Tests:**
  - Unit: password hashing/verification, token generation/expiry, lockout counter logic.
  - Integration: registration → login → protected route round-trip per actor type; reset-token single-use enforcement.
  - E2E: customer registers and logs into storefront; seller logs into seller portal; admin logs into admin portal; wrong-portal login is rejected.

---

### 9.2 Customers

**Domain module:** `customers`

- **User story:** As a customer, I want to manage my profile, addresses, and view my order history so I can shop efficiently and track my purchases.
- **Acceptance criteria:** Create/edit profile and shipping/billing addresses; view past and current orders across all sellers; view order status per vendor sub-order.
- **Data ownership:** `customer`, `customer_address` (Medusa customer module). Owned by the customer; not seller-scoped.
- **Authorization rules:** A customer may only read/write their own profile, addresses, and orders. Admins may read (not silently write) customer data for support purposes, logged via audit log.
- **Validation requirements:** Valid US address format (state, ZIP); required fields for checkout eligibility.
- **Failure states:** Duplicate address save is idempotent (update, not duplicate row); malformed address blocks checkout with field-level errors.
- **Security risks:** PII exposure (addresses, order history) if authorization checks are missed; admin over-access without audit trail.
- **Tests:**
  - Unit: address validation rules.
  - Integration: customer cannot fetch another customer's profile/orders via API (authz test).
  - E2E: customer edits profile and address, sees updated data reflected at next checkout.

---

### 9.3 Sellers

**Domain module:** `sellers`

- **User story:** As an approved seller, I want a seller account that represents my brand so I can manage products, orders, and payouts independently of other sellers.
- **Acceptance criteria:** Seller entity holds brand name, slug, description, logo, support contact, status (`pending`, `approved`, `suspended`, `rejected`); seller has one or more seller-user accounts with roles.
- **Data ownership:** `seller`, `seller_user`, `seller_user_role` tables. This is the root `vendor_id` referenced by every other seller-scoped table.
- **Authorization rules:** Only the seller's own users (per role) can read/write that seller's record; admins can read all sellers and change status; only Super Admin can hard-delete a seller.
- **Validation requirements:** Unique brand slug; required legal business name for Stripe Connect; status transitions follow an explicit state machine (see [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md)).
- **Failure states:** Suspended seller's products are automatically de-listed from storefront search/browse but existing orders remain manageable for fulfillment/returns.
- **Security risks:** Privilege escalation between seller-user roles; a suspended seller retaining API access; slug collision/spoofing of another brand's identity.
- **Tests:**
  - Unit: status state-machine transition validation.
  - Integration: suspending a seller hides its products from storefront queries but not from existing order detail views.
  - E2E: admin suspends a seller; seller's storefront listings disappear; seller portal shows a suspended banner and blocks new listings.

---

### 9.4 Seller Onboarding

**Domain module:** `seller-onboarding`

- **User story:** As a prospective seller, I want to apply, get approved, and connect my payout account so I can start selling.
- **Acceptance criteria:** Application form → admin review queue → approve/reject with reason → on approval, seller completes Stripe Connect Express onboarding → seller cannot list products or receive payouts until Stripe onboarding reports `charges_enabled` and `payouts_enabled`.
- **Data ownership:** `seller_application`, and the Stripe account reference fields on `seller` (`stripe_account_id`, onboarding status). Full flow in [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md) and [`PAYMENTS.md`](PAYMENTS.md).
- **Authorization rules:** Only Admin/Super Admin can approve/reject applications; only the seller owner can initiate/resume Stripe onboarding for their own seller.
- **Validation requirements:** Required business fields before submission; Stripe account requirements enforced by Stripe's hosted onboarding (not re-implemented by the platform).
- **Failure states:** Rejected application stores a reason and allows re-application; incomplete Stripe onboarding blocks the "go live" toggle with a clear checklist of remaining requirements.
- **Security risks:** Approving a seller without adequate vetting; trusting client-reported Stripe onboarding status instead of verifying via webhook/API; onboarding link leakage (Stripe account-linking URLs are single-use and short-lived — must not be logged or cached).
- **Tests:**
  - Unit: application → approval state machine; onboarding-status derivation from Stripe account object.
  - Integration: webhook-driven update of `charges_enabled`/`payouts_enabled` correctly flips seller "go live" eligibility.
  - E2E: full apply → approve → Stripe onboarding (test mode) → first product listing unlocked.

---

### 9.5 Catalog & Categories *(implemented)*

**Domain modules:** native Medusa `product-category` + custom `category-translation`

- **User story:** As a seller, I want to organize my products into categories that fit the platform's taxonomy so customers can browse and filter effectively. As an admin, I want to manage a nested category tree with translated names, so the taxonomy stays consistent across languages and can be reorganized without a code change.
- **Acceptance criteria:** Platform-owned category tree (not seller-editable, to keep taxonomy consistent), with arbitrary-depth parent/child nesting; products assigned to exactly one category; category pages list `approved` products from all sellers. Admin can create, edit (including moving a category to a different parent), and delete categories; deletion is refused while the category still has child categories or products assigned. Category names are translatable into all five non-English supported locales, with English (the category's native `name`) always the fallback.
- **Data ownership:** native `product_category` (Medusa) - platform-owned, no `vendor_id`. Custom `category_translation` (`category_id` + `locale` + `name`) - also platform-owned, admin-authored directly (no seller-submission workflow, unlike product translations).
- **Authorization rules:** Only Admin manages the category tree and its translations (`/admin/categories*`, `authenticate("user", ...)`); sellers may only assign their own products to existing `is_active` categories via `GET /seller/categories`.
- **Validation requirements:** A `parent_category_id` that would make a category its own ancestor is rejected (422, `wouldCreateCycle` ancestor-chain walk); translation locale keys are restricted to the five non-English supported locales (400 otherwise).
- **Failure states:** Deleting a category with child categories or assigned products returns 409, not a silent cascade or orphan.
- **Security risks:** Sellers attempting to create/modify categories directly via API - blocked by the `authenticate("user", ...)` middleware on `/admin/categories*`, not just hidden in the seller-portal UI.
- **Tests:**
  - Unit: cycle-detection (`wouldCreateCycle`), tree-building (`buildCategoryTree`), create/update schema validation, translatable-locale validation.
  - Integration: unauthenticated/non-admin create is rejected; parent/child creation and the resulting tree; self-parent and descendant-cycle rejection; translation set + English fallback; delete blocked by children/products, allowed once empty; only `is_active` categories on the public route.
  - E2E: admin creates a parent category, a nested child, edits a translation, and confirms deletion is blocked-then-allowed after removing the child first.

---

### 9.6 Products & Product Variants

**Domain modules:** `products`, `product-variants`

- **User story:** As a seller, I want to list products with variants (size, color) so customers can pick the exact item they want.
- **Acceptance criteria:** Product has title, description, images, brand (= seller), category, status (`draft`, `published`, `archived`); each product has ≥1 variant with SKU, size/color options, price, and inventory link. Every product also gets a **permanent `product_code`**, issued once and never reused or reassigned even if the product is retitled, re-slugged, or archived — distinct from the (mutable, human-editable) slug. See [`DECISIONS.md`](DECISIONS.md).
- **Data ownership:** `product`, `product_variant`, `product_option`, `product_image` — all carry `vendor_id` (the owning seller). Owned exclusively by the seller that created them.
- **Authorization rules:** A seller can only create/edit/delete their own products and variants; admins can read all products and can unpublish/moderate any product; no seller can read another seller's draft products.
- **Validation requirements:** Required title, ≥1 image, ≥1 published variant with price and SKU before a product can move to `published`; SKU unique per seller (not necessarily platform-wide). **The variant SKU is private** — it is the seller's own internal reference and is never returned from a public/storefront-facing endpoint, same sensitivity tier as `seller_application.rejection_reason` (see [`SECURITY.md`](SECURITY.md) §11).
- **Failure states:** Publishing without a complete variant set is blocked with field-level errors; deleting a product referenced by past orders is disallowed (archive instead, to preserve order history integrity).
- **Security risks:** Cross-seller data leakage via a missing `vendor_id` filter on a list/detail query; image upload used to smuggle non-image files (must validate MIME/type and size server-side, not just by extension).
- **Tests:**
  - Unit: product publish-readiness validation; variant SKU uniqueness scoped to seller.
  - Integration: seller A's authenticated API call cannot fetch, edit, or delete seller B's product/variant (explicit negative authz test).
  - E2E: seller creates a product with two variants, publishes it, and it appears correctly on the storefront product page with variant selectors.

---

### 9.7 Inventory

**Domain module:** `inventory`

- **User story:** As a seller, I want accurate stock counts per variant so I never oversell an item.
- **Acceptance criteria:** Each variant has an inventory quantity per seller-managed stock location; quantity decrements on order placement (reserved) and confirms on payment capture; restores on cancellation/return.
- **Data ownership:** `inventory_item`, `inventory_level`, `reservation` (Medusa inventory module) — scoped to the owning seller's stock location(s).
- **Authorization rules:** Only the owning seller can adjust their inventory; the checkout/order workflow adjusts inventory programmatically, not via direct seller action.
- **Validation requirements:** Quantity cannot go negative; reservation must be released if payment fails or cart is abandoned past a timeout.
- **Failure states:** Two customers checking out the last unit concurrently → one succeeds, one gets a clear "no longer available" failure before payment capture (never after).
- **Security risks:** Race conditions causing oversell; a seller manipulating inventory of a product mid-checkout to bypass a reservation.
- **Tests:**
  - Unit: reservation/decrement/restore arithmetic; negative-quantity guard.
  - Integration: concurrent checkout attempts on last-unit stock resolve to exactly one success (DB-level locking test).
  - E2E: customer adds last unit to cart, a second customer's concurrent checkout is rejected before payment.

---

### 9.8 Pricing

**Domain module:** `pricing`

- **User story:** As a seller, I want to set and update prices for my variants so I control my own margins.
- **Acceptance criteria:** Price per variant in USD; supports sale/compare-at price; price changes take effect immediately for new carts, but an already-placed order retains its original price.
- **Data ownership:** `price`, `price_set` (Medusa pricing module) linked to the seller's variant.
- **Authorization rules:** Only the owning seller edits their prices; commission calculation (platform-owned) reads price but is not seller-editable.
- **Validation requirements:** Price ≥ $0.01; compare-at price, if set, must be ≥ current price.
- **Failure states:** Price update mid-checkout does not retroactively change an in-flight cart's checkout total inconsistently — cart re-validates price at payment time and surfaces a "price changed" prompt if it moved.
- **Security risks:** Client-supplied price tampering (server must always price from the database at checkout, never trust a client-sent amount).
- **Tests:**
  - Unit: price validation rules; compare-at consistency.
  - Integration: checkout re-prices from server-side data even if client cache is stale.
  - E2E: seller changes a price; new visitors see new price; a cart opened before the change is prompted on price change at checkout.

---

### 9.9 Product discovery, search, and filtering *(implemented)*

**Domain module:** `packages/search-contract` + `apps/backend/src/search` (v1 `PostgresSearchService`)

- **User story:** As a customer, I want to browse a homepage and category pages, search and filter products, and sort results, so I can find what I'm looking for across all sellers on desktop or mobile.
- **Acceptance criteria:** Fashion-focused homepage with a "shop by category" rail and a "new arrivals" grid; category browse pages (`/categories/:handle`); a search page (`/search`) with keyword search across title/description/brand; filters for category, brand (seller), size, color, price range, and availability; sort by newest/price-ascending/price-descending; cursor-based "Load more" pagination; explicit loading/empty/error states; a mobile filter drawer (desktop shows the same filters as an always-visible sidebar). Only `approved` `product_listing` rows are ever returned - draft/pending_review/rejected/archived are excluded at the query's first filter, not by response-shaping after the fact.
- **Data ownership:** No independent search index in v1 - `PostgresSearchService` queries live `product_listing` + native `product`/`product_variant`/inventory/pricing data directly through Medusa's query engine (`ContainerRegistrationKeys.QUERY`) on every request. See `docs/ARCHITECTURE.md` §6 and `docs/DECISIONS.md` for why this is deliberately simpler than a denormalized index for v1.
- **Authorization rules:** `/categories`, `/products`, `/brands` are all public/unauthenticated reads; no seller can bias ranking (no seller-controlled ranking fields).
- **Validation requirements:** `sort` restricted to `newest|price_asc|price_desc` (falls back to `newest`); `limit` clamped to a max of 60; unrecognized query params are ignored, not errors.
- **Failure states:** Because there's no index to lag, a just-approved product is visible on the very next request - no propagation window to reason about. A backend fetch failure renders an explicit error state with a message, not a blank page or an unhandled exception.
- **Security risks:** Search/filter responses never include `vendor_id`, the private variant SKU, or seller identity beyond the public brand name - verified by an integration test that serializes the full response and asserts those strings are absent, same discipline as the single-product route.
- **Tests:**
  - Unit: search-cursor encode/decode round-trip and malformed-input handling; category cycle-detection and tree-building (shared with §9.5); category/product-input schema validation.
  - Integration: approved-only visibility (draft/pending_review/rejected excluded); category/brand/size/color/price/availability filters; newest/price-asc/price-desc sort; cursor pagination returns every item exactly once across pages; no `vendor_id`/`sku` leakage; brand list excludes sellers with zero approved listings.
  - Component: filter form field rendering and URL-param updates on submit/clear; sort-select URL updates; product card rendering (price formatting, sold-out badge); admin category form rendering (create/edit modes, translation fields).
  - E2E: storefront homepage → category page → search → filter → sort, confirming a draft product is never visible anywhere and a mobile viewport exposes filters through a drawer; admin creates a parent category, a nested child, edits a translation, and confirms delete-blocked-then-allowed.
- **Forward compatibility:** All search reads go through the `SearchService` interface in `packages/search-contract` (see [`ARCHITECTURE.md`](ARCHITECTURE.md) §6) so a ranked-relevance or external provider (Algolia) can be swapped in later without changing `apps/backend/src/api/products/route.ts` or any frontend caller.

---

### 9.10 Cart (implemented)

**Domain module:** native Medusa `cart` module, with custom marketplace validation/privacy logic in `apps/backend/src/cart/`

- **User story:** As a customer, I want to add items from multiple sellers to one cart so I can check out once.
- **Acceptance criteria:** Cart holds line items from any number of sellers, presented as one unified Bawi cart (no vendor count/grouping surfaced); cart persists across sessions for logged-in customers (resolved by `customer_id`); guest cart persists via an opaque cart id (httpOnly/secure/`SameSite=Lax` cookie on the storefront, forwarded to the backend as an `x-cart-id` header) until login/merge or the configurable expiration window elapses.
- **Data ownership:** `cart`, native Medusa line items (unmodified schema). Not seller-scoped — owned by the customer/session. Vendor ownership per line item lives only in the line item's internal `metadata.vendor_id`, never serialized to any response — enough to split the order in a later checkout/fulfillment phase.
- **Authorization rules:** Only the owning customer/session can read or mutate their cart (guest: cart id must match and the cart must still be an actual guest cart, i.e. `customer_id IS NULL`; customer: resolved strictly by `customer_id` from the verified session, never a client-supplied id). Seller and admin actor types have no route that can reach cart data.
- **Validation requirements:** `variant_id` is the only product reference accepted from the client — price, vendor ownership, and availability are always re-resolved server-side (`resolveCartVariant`), never trusted from the request or from what's stored on the line item. Quantity must be a positive whole number, within the configurable per-line-item maximum, and within currently available inventory (hard rejection at add/update time, not a soft check). Only a `product_listing` with `status: "approved"` can be added or remain resolvable.
- **Failure states:** Adding a draft/pending_review/rejected/archived/out-of-stock variant, or a quantity above inventory/the maximum, is rejected (400/404) with a clear message. An item that becomes unavailable or under-stocked *after* being added is not silently dropped — it stays in the cart, flagged (`is_available`/`quantity_exceeds_inventory` warning) and excluded from the subtotal, with `checkout_blocked: true` on the cart. A price drift is detected and persisted on every read, surfaced as a `price_changed` warning. Guest-cart merge on login resolves quantity conflicts by summing and capping to live inventory/the maximum, never rejecting; a repeated merge call for the same guest cart is idempotent (a no-op once already claimed).
- **Security risks:** Cart line items must reference server-side price/inventory, never accept a client-supplied price or override (verified by an integration test that submits both and asserts they're ignored); cart access must not leak another customer's cart via a guessable ID (guest cart ids are Medusa's own ULIDs). Public cart responses never include `vendor_id`, seller id, Stripe account id, private SKU, or pickup location; a per-item `brand` is resolved through the same `public_brand_display_approved` gate used elsewhere (`resolvePublicBrand()`), not the seller's raw name.
- **Tests:**
  - Unit: quantity validation (`validateRequestedQuantity`), shipping-estimate/free-shipping-threshold calculation, cart-expiration boundary logic, `resolvePublicBrand`.
  - Integration: guest and authenticated cart create/update, multi-vendor cart, no private-data leakage, seller cannot reach cart data, client-submitted price/vendor_id ignored, every non-approved/out-of-stock/over-quantity case rejected, price/availability drift reflected on refresh, guest-to-customer merge (including the quantity-conflict and idempotent-replay cases), cart expiration.
  - E2E: customer adds products from two different sellers and sees one cart; quantity update and item removal; registering with an existing guest cart merges without duplicates; a returning customer's cart persists across a fresh login; an item that becomes unavailable is flagged; no vendor identity or private SKU appears anywhere in the UI or a captured network response.

---

### 9.11 Checkout

**Domain module:** `checkout`

- **User story:** As a customer, I want a single checkout flow — one shipping/payment entry — that correctly handles items from multiple sellers behind the scenes.
- **Acceptance criteria:** Single address/shipping-method entry per shippable group (see shipping); single payment authorization for the full cart total; order confirmation summarizes per-vendor sub-orders and their individual shipping/return terms.
- **Data ownership:** Checkout is an orchestration workflow, not a standalone owned table set — it reads cart/pricing/inventory and writes to `order` + `payment` (see §9.13, §9.14).
- **Authorization rules:** Only the owning customer can execute checkout on their own cart; server re-validates every price/inventory/tax figure — the client never supplies authoritative totals.
- **Validation requirements:** All cart items still available and priced correctly at submit time; valid US shipping address; valid payment method.
- **Failure states:** Partial inventory failure (one seller's item sold out mid-checkout) blocks checkout for that line item only, with a prompt to remove/adjust before retrying — never a partially-charged customer.
- **Security risks:** Double-submission creating duplicate orders/charges (idempotency key required per checkout attempt); price/total tampering from client; abandoned-checkout payment retries creating orphaned holds.
- **Tests:**
  - Unit: idempotency-key generation and totals recomputation.
  - Integration: checkout with a mid-flight inventory failure fails cleanly with no partial charge.
  - E2E: customer completes checkout with items from two sellers, receives one confirmation covering two vendor sub-orders.

---

### 9.12 Payments

**Domain module:** `payments`

Fully detailed in [`PAYMENTS.md`](PAYMENTS.md) (Stripe Connect model, split-payment mechanics, webhook idempotency). Summary acceptance criteria: one PaymentIntent per checkout charged to the platform's Stripe account; funds later transferred to each seller's connected account net of commission; all webhook handlers idempotent by Stripe event ID; no raw card data ever touches platform servers (Stripe Payment Element only).

---

### 9.13 Commissions

**Domain module:** `commissions`

- **User story:** As the platform, I want to automatically calculate and record the commission owed on every order so revenue is never manually reconciled.
- **Acceptance criteria:** Commission computed per vendor sub-order at order-creation time using the seller's effective commission rate (seller-specific override, else category default, else platform default); recorded as an immutable ledger line; reversed proportionally on refund.
- **Data ownership:** `commission_rule`, `commission_ledger_entry` — platform-owned, but each ledger entry references the owning `vendor_id` for seller-facing reporting.
- **Authorization rules:** Only Admin/Super Admin can set commission rules; sellers have read-only access to their own commission history.
- **Validation requirements:** Rate between 0–100%; exactly one effective rate resolvable per order line (deterministic precedence: seller override > category > platform default).
- **Failure states:** Missing/ambiguous rate resolution blocks order finalization rather than silently defaulting to 0%.
- **Security risks:** A seller manipulating their own commission rate (must be admin-only write, verified server-side); rounding errors accumulating across high volume (use integer minor-unit arithmetic, never floats).
- **Tests:**
  - Unit: rate-precedence resolution; integer-cents rounding.
  - Integration: refund triggers a proportional, correctly-signed reversal ledger entry.
  - E2E: admin sets a category override rate; a new order in that category reflects the correct commission in the seller's dashboard.

---

### 9.14 Payouts

**Domain module:** `payouts`

- **User story:** As a seller, I want to receive my earnings (minus commission) automatically and see a clear payout history.
- **Acceptance criteria:** Payouts move funds from the platform's Stripe balance to each seller's connected Stripe Express account via Transfers, on a defined schedule (e.g., rolling/weekly, configurable); seller portal shows payout history and pending balance.
- **Data ownership:** `payout`, `payout_line_item` referencing `commission_ledger_entry` — scoped by `vendor_id`.
- **Authorization rules:** Only the owning seller can view their own payouts; only the payout background job (system actor) creates Transfers; admins have read access for support/dispute handling.
- **Validation requirements:** A payout only includes funds from captured, non-refunded (or already-adjusted) orders; a seller with incomplete Stripe onboarding cannot receive a Transfer (checked immediately before creating it, not just at onboarding time).
- **Failure states:** Stripe Transfer failure (e.g., account restricted) marks the payout `failed`, retries on a backoff schedule, and surfaces the reason to both seller and admin.
- **Security risks:** Double-payout of the same ledger entries (must mark ledger entries as "paid out" atomically with Transfer creation); payout job must be idempotent like all payment-adjacent code.
- **Tests:**
  - Unit: payout batch selection (only unpaid, settled ledger entries).
  - Integration: re-running the payout job does not double-pay the same entries.
  - E2E: seller completes onboarding, an order settles, the next payout cycle shows the correct net amount in their dashboard.

---

### 9.15 Orders & Vendor-Order Splitting

**Domain modules:** `orders`, `vendor-order-splitting`

- **User story:** As a customer, I want one order confirmation even though my cart spans multiple sellers; as a seller, I want to see and manage only my portion of that order.
- **Acceptance criteria:** One `order` (customer-facing, "order group") splits automatically into one `vendor_order` per seller present in the cart, each with its own status lifecycle (`pending`, `confirmed`, `shipped`, `delivered`, `cancelled`, `returned`); customer sees a unified view with per-vendor sub-status; seller sees only their own `vendor_order`(s).
- **Data ownership:** `order` (customer-owned, cross-vendor), `vendor_order` and `vendor_order_item` (carry `vendor_id`, seller-owned for fulfillment purposes but linked back to the parent order for the customer view).
- **Authorization rules:** A seller can only read/update `vendor_order` rows matching their own `vendor_id`; a customer can only read orders where they are the owning customer; admins can read all.
- **Validation requirements:** Splitting logic is deterministic and runs exactly once per checkout (idempotent on the checkout's idempotency key); every `vendor_order_item` traces back to a cart line item and a vendor.
- **Failure states:** If splitting fails partway (e.g., one seller's stock reservation fails after payment capture began), the whole checkout fails atomically before capture — never a partially-split order with a captured payment and no corresponding vendor order.
- **Security risks:** A seller querying `vendor_order` without a `vendor_id` filter (must be enforced in the module's service layer, not left to callers); status transitions bypassing the state machine (e.g., a seller marking another seller's item "shipped").
- **Tests:**
  - Unit: order → vendor_order splitting algorithm; status state-machine transitions.
  - Integration: seller API calls are scoped to their own `vendor_order`s only (negative authz test); splitting is idempotent under retry.
  - E2E: customer checks out a 2-seller cart; each seller sees only their own sub-order in their portal; customer's order page shows both.

---

### 9.16 Shipping

**Domain module:** `shipping`

- **User story:** As a seller, I want to define my own shipping options and rates, and mark orders shipped with tracking, so customers know when to expect their items.
- **Acceptance criteria:** Seller configures shipping options (e.g., standard/express) and flat or weight-based rates per option; at fulfillment, seller enters a carrier + tracking number; customer sees tracking per vendor sub-order.
- **Data ownership:** `shipping_option`, `shipment` — scoped by `vendor_id` (Medusa fulfillment module, seller-scoped provider config).
- **Authorization rules:** Only the owning seller manages their shipping options and marks their own shipments; customer/admin have read access.
- **Validation requirements:** At least one active shipping option required before a seller can go live; tracking number format loosely validated (non-empty, carrier-appropriate pattern where known).
- **Failure states:** Marking "shipped" without a tracking number is allowed only if the seller explicitly opts out of tracked shipping for that option (flagged clearly to the customer).
- **Security risks:** A seller's shipping config leaking into another seller's checkout rate calculation; tampering with shipping cost client-side (server always recalculates from the seller's own configured rates).
- **Tests:**
  - Unit: rate calculation per shipping option.
  - Integration: checkout applies each seller's own shipping rate independently within one order.
  - E2E: seller adds a tracking number; customer's order detail page reflects it immediately.

---

### 9.17 Returns & Refunds

**Domain modules:** `returns`, `refunds`

- **User story:** As a customer, I want to request a return on an item I bought and get refunded once the seller (or admin) approves it.
- **Acceptance criteria:** Customer requests a return against a specific `vendor_order_item` within a return window (seller- or platform-configured); seller (or admin, on escalation) approves/denies with a reason; approved return triggers a refund through Stripe and a proportional commission reversal.
- **Data ownership:** `return_request`, `refund` — scoped by `vendor_id` (return/refund always belongs to exactly one seller's sub-order) and linked to the parent `order` for the customer view.
- **Authorization rules:** Customer can create/view only their own return requests; seller can approve/deny only returns against their own `vendor_order`s; admin can override/escalate any return.
- **Validation requirements:** Return window enforced server-side; refund amount cannot exceed the original captured payment for that item; a return can only be actioned once (no double-refund).
- **Failure states:** Refund attempt against an already-refunded item is rejected idempotently, not silently re-processed; Stripe refund failure surfaces to admin for manual follow-up rather than silently marking the return "complete."
- **Security risks:** Refund-amount tampering (server computes from stored order data, never a client-sent amount); a seller approving a refund larger than the original charge; replayed refund webhook causing a duplicate refund (idempotency by Stripe event ID).
- **Tests:**
  - Unit: return-window enforcement; refund-amount bounds checking.
  - Integration: refund triggers correct Stripe refund call and correct commission reversal ledger entry in one transaction/workflow.
  - E2E: customer requests a return, seller approves it, customer sees refund status update and receives a notification.

---

### 9.18 Reviews

**Domain module:** `reviews`

- **User story:** As a customer, I want to leave a review on a product I purchased so other shoppers can make informed decisions.
- **Acceptance criteria:** Review allowed only for a verified purchase (customer has a delivered `vendor_order_item` for that product); star rating + text; seller can publicly respond once; reviews go through moderation before appearing publicly (see §9.19).
- **Data ownership:** `review`, `review_response` — linked to `product` (`vendor_id` inherited) and the reviewing `customer_id`.
- **Authorization rules:** Only the verified purchaser can create a review for that purchase; only the owning seller can respond to a review on their product; admin can moderate/remove any review.
- **Validation requirements:** One review per customer per purchased item; rating 1–5; text length bounds; profanity/PII basic filtering before entering the moderation queue.
- **Failure states:** Attempted duplicate review on the same purchase is rejected with a clear message pointing to the existing review (editable instead).
- **Security risks:** Fake reviews from non-purchasers (enforced via verified-purchase check, not client-trusted); stored-XSS via review text (sanitize/escape on render, never trust raw HTML).
- **Tests:**
  - Unit: verified-purchase eligibility check; duplicate-review prevention.
  - Integration: review submission enters the moderation queue and is not publicly visible until approved.
  - E2E: customer receives a delivered order, leaves a review, seller responds, review appears on the product page after moderation approval.

---

### 9.19 Moderation

**Domain module:** `moderation`

- **User story:** As an admin, I want a queue of products and reviews awaiting or flagged for moderation so I can keep the marketplace's content clean and compliant.
- **Acceptance criteria:** New products and reviews enter a moderation queue (either pre-publish gate or post-publish flag-based, per content type — see [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md)); admin can approve, reject with reason, or request changes; customers/sellers can flag existing content for re-review.
- **Data ownership:** `moderation_item` (polymorphic reference to `product` or `review`), `moderation_flag` — platform-owned.
- **Authorization rules:** Only Admin/Super Admin acts on moderation items; sellers/customers can only create flags, not resolve them.
- **Validation requirements:** A moderation decision must record an actor and, for rejections, a reason (never a silent rejection).
- **Failure states:** A flagged-but-not-yet-reviewed item remains visible (flag-based) or hidden (pre-publish gate) per its content type's configured policy — this must be unambiguous per type, not left to interpretation.
- **Security risks:** A rejected product silently reappearing on re-save without re-entering the queue; moderation actions without audit trail.
- **Tests:**
  - Unit: moderation state-machine per content type.
  - Integration: rejecting a product removes it from storefront search/browse immediately.
  - E2E: admin rejects a flagged review; it disappears from the product page; the audit log records the action.

---

### 9.20 Notifications *(implemented)*

**Domain module:** native Medusa `notification` module + custom `notification_inbox` (see `docs/DECISIONS.md`)

- **User story:** As a customer or seller, I want timely emails about my orders, shipments, returns, and payouts so I stay informed without checking the portal constantly.
- **Acceptance criteria:** Transactional emails for: order confirmation, shipment/tracking update, return status change, refund processed, seller payout sent, seller application approved/rejected. Templated, branded consistently with the design system.
- **Data ownership:** `notification_template`, `notification_log` — platform-owned; `notification_log` entries reference the recipient (`customer_id`, `seller_user_id`, or admin) and, where applicable, `vendor_id`.
- **Authorization rules:** Only the system (background job) sends notifications; no user-facing API to send arbitrary notifications to another user.
- **Validation requirements:** Every notification is deduped against `notification_log` before sending (no duplicate emails for the same event).
- **Failure states:** Email provider failure is retried with backoff and logged; it never blocks the underlying business transaction (e.g., a failed shipment-email send must not roll back the shipment update).
- **Security risks:** Notification content must not leak another party's data (e.g., a shipment email must never include another seller's order details); email template injection from user-supplied content (sanitize before interpolation).
- **Tests:**
  - Unit: dedup-by-event-id logic; template rendering with escaping.
  - Integration: order confirmation email fires exactly once per order even under retry.
  - E2E: full order → shipment → delivery flow produces the expected sequence of emails in a test inbox.

---

### 9.21 Reporting

**Domain module:** `reporting`

- **User story:** As a seller, I want to see my sales, orders, and payout summaries; as an admin, I want platform-wide visibility into GMV, commission revenue, and seller performance.
- **Acceptance criteria:** Seller dashboard: sales over time, order counts, top products, payout summary — scoped to their own `vendor_id`. Admin dashboard: platform GMV, commission revenue, active sellers, order volume, return rate.
- **Data ownership:** Reporting reads existing owned tables (orders, commissions, payouts) via scoped aggregation queries/views; it does not own primary data.
- **Authorization rules:** Seller reporting endpoints are hard-scoped to the caller's own `vendor_id`; platform-wide reporting is Admin/Super Admin only.
- **Validation requirements:** Date-range inputs bounded and validated; aggregation queries scoped server-side (never accept a client-supplied `vendor_id` filter for a seller caller — the caller's own ID is always used, ignoring any client override).
- **Failure states:** Large date ranges degrade gracefully (paginated/summarized) rather than timing out.
- **Security risks:** A seller passing another seller's ID as a query parameter to view their reporting (must be rejected server-side regardless of client input).
- **Tests:**
  - Unit: aggregation query correctness against known fixture data.
  - Integration: seller reporting endpoint ignores/rejects a client-supplied foreign `vendor_id`.
  - E2E: seller views their sales dashboard after a completed order and sees correct figures.

---

### 9.22 Audit Logs

**Domain module:** `audit-logs`

- **User story:** As an admin/compliance stakeholder, I want an immutable record of every sensitive action so we can investigate disputes and satisfy compliance requirements.
- **Acceptance criteria:** Every sensitive action (see [`SECURITY.md`](SECURITY.md) for the full list) writes an append-only `audit_log` entry with actor, action, entity, before/after state where relevant, timestamp, and IP.
- **Data ownership:** `audit_log` — platform-owned, append-only; entries reference `vendor_id` where the action is seller-scoped.
- **Authorization rules:** No one can update or delete audit log entries through the application (append-only at the DB/permission level); only Admin/Super Admin can read audit logs, scoped to their own investigation needs; sellers may see a limited, filtered audit trail of actions on their own account (e.g., their own status changes) but not platform-wide logs.
- **Validation requirements:** An audit entry is written in the same transaction/workflow as the action it records — never best-effort/fire-and-forget for critical actions (payment, refund, seller status, role changes).
- **Failure states:** If audit logging fails for a critical action, the triggering action itself fails/rolls back rather than proceeding silently unlogged.
- **Security risks:** Tampering with historical entries (mitigated by DB-level append-only constraints/permissions, not just application code); audit log itself leaking cross-seller data to a seller-scoped viewer.
- **Tests:**
  - Unit: audit entry shape/required fields per action type.
  - Integration: a seller status change and its audit entry commit atomically; a forced audit-write failure rolls back the parent action.
  - E2E: admin performs a seller suspension; the audit log shows the action with correct actor/timestamp/reason.

---

### 9.23 Private Fulfillment & Delivery *(implemented)*

**Domain modules:** `fulfillment-privacy` (implemented), `courier` role (implemented)

- **User story:** As a customer or seller, I want my order fulfilled without either party learning the other's real identity or contact details, so the marketplace — not an individual seller or courier — is who I trust with my information.
- **Decided model:** Bawi Shopping is a **private-vendor-fulfillment marketplace** — customers shop only from Bawi, never directly from a vendor. Bawi controls product listings, pricing, customer service, tracking, returns, receipts, and vendor communication; sellers fulfill orders but never gain customer identity, contact, payment, or delivery-address information, and customers never gain vendor identity or pickup-location information.
- **Order-level codes (three, distinct):** a temporary **fulfillment code**, a temporary **pickup code**, and a temporary **tracking code** — each scoped to its own purpose, separate from the permanent `product_code` (§9.6). **Pickup codes are single-use and expire on collection** (consumed the moment pickup is confirmed, not just time-limited).
- **Per-role information scoping:**
  - **Vendors** receive, per order, only: product, size, quantity, a preparation deadline, and pickup instructions. Never the customer's name, contact details, payment information, or delivery address.
  - **Couriers** receive only the pickup and delivery information needed for their one assigned delivery — no broader account or order access.
  - **Seller-facing APIs must never return customer delivery information** — an absolute rule, not a best-effort filter, to be designed and tested from the first order-related endpoint onward.
- **Architecture flexibility:** the design must support either **direct courier pickup at the vendor's location** or a **future Bawi-operated sorting hub** — pickup location must be a resolvable value per order, not an assumption baked into fulfillment-code generation. (This slice's single shared stock location, `apps/backend/src/workflows/shared/default-stock-location.ts`, is already compatible with this — it doesn't assume per-vendor pickup addresses.)
- **What this means for the current product-catalog slice:** the `product` table gets a permanent `product_code` (§9.6); seller identity is never exposed to customers beyond what the product spec already required; vendor IDs stay server-side and private (never in a client-facing response); the schema does not yet grow fulfillment-code, pickup-code, or tracking-code tables.
- **Implemented:** delivery execution end to end (preparing → ready for pickup → picked up → out for delivery → delivered), fulfillment/pickup/tracking-code generation and validation, the courier role's portal/API. **Explicitly not built yet:** a real QR-scanning UI (codes are entered as text, not scanned from a rendered QR image - the underlying code/validation model is QR-ready, only the scan-camera UI isn't built), Bawi-mediated messaging, returns handling, photo/signature proof of delivery (the delivery-confirmation code is this slice's proof-of-delivery mechanism).
- **Security risks (for when this is built):** a leaked or reused pickup code granting delivery access to the wrong person (single-use + expire-on-collection are non-negotiable, not just a UX nicety); a courier session scoped too broadly and able to read customer/seller PII beyond its one assigned delivery; a vendor-facing order view accidentally including customer PII because it was filtered rather than built to exclude it by construction; fulfillment/pickup/tracking codes guessable/sequential (must be unguessable, same as order IDs — see [`SECURITY.md`](SECURITY.md) §5); all sensitive access and status changes must be audit-logged (CLAUDE.md rule #6, extended to code issuance/consumption).
- **Merchant-of-record:** **resolved — Bawi Shopping is the merchant of record.** Bawi has legal authority over returns, tax, liability, and receipts; a vendor never appears as the customer-facing merchant. See [`DECISIONS.md`](DECISIONS.md).

---

### 9.24 Localization & Translations *(implemented — i18n foundation plus product-content moderation)*

**Domain module:** `product-translation` (content/moderation - implemented, Batch 5); i18n plumbing (`packages/i18n`) - implemented earlier — see [`ARCHITECTURE.md`](ARCHITECTURE.md) §12.

- **User story:** As a customer who reads Amharic, Tigrinya, Afaan Oromo, Simplified Chinese, or Spanish, I want to browse and shop in my language.
- **Supported locales:** English `en-US` (fallback), Amharic `am`, Tigrinya `ti`, Afaan Oromo `om`, Simplified Chinese `zh-CN`, Spanish `es`.
- **Decided model:**
  1. A **language selector** on the storefront; the customer's selection is **remembered** (persisted, not re-asked every visit).
  2. **English is the unconditional fallback** wherever a translation is unavailable — never a blank string or a raw i18n key shown to a user.
  3. Translated surfaces (as each is built): navigation, forms, buttons, validation messages, product categories, product descriptions, policies, emails, and order updates.
  4. **One product record per product, always.** Translations are stored in a table **separate from the base product record** (keyed by `product_id` + `locale`), never inline per-locale columns and never duplicate per-language product rows.
  5. **Admins review and edit product translations**; **sellers may submit translations, but Bawi controls what's published** — same moderation shape as product approval (§9.19), not an auto-publish path.
  6. **Search must eventually recognize products in every supported language** — not required this slice, but the search interface (§9.9) must not be designed in a way that forecloses per-locale indexing later.
  7. **Unreviewed AI translations are never auto-published** — same approval gate as (5), regardless of translation source.
  8. **Prices stay USD-only** for this release; locale changes display language, not currency.
  9. **Amharic and Tigrinya (Ge'ez script) must render correctly** throughout the interface, database, emails, and search — a UTF-8-throughout requirement, not solved by the font alone.
  10. **Layouts must tolerate longer translated text** without breaking buttons, menus, forms, or mobile screens (see [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §12).
  11. **Accessibility labels are localized** in the selected language, not hard-coded English (see [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §8).
  12. **No separate application and no separate product record per language** — one codebase, one product table, locale is a rendering/lookup concern, not a data-partitioning one.
- **What's built (i18n foundation, earlier slice):** locale context/provider, cookie-based locale persistence, an English-fallback string-lookup mechanism, and a fully-translated message catalog for all six locales — wired into the storefront (and reused directly by `apps/seller-portal`/`apps/admin` where each app needed a locale label). See [`ARCHITECTURE.md`](ARCHITECTURE.md) §12 and [`TESTING.md`](TESTING.md) for the foundation-level tests (switching, persistence, fallback, non-Latin rendering, mobile layout resilience).
- **What's built (product-content translation, this slice):** the `product_translation` module and its full moderation lifecycle - a seller drafts and submits a title/description per locale (seller-portal `/products/:id/translations`), an admin approves or rejects it (`/translations`), and only an `approved` row is ever resolved on the public product-detail route (`GET /products/:code?locale=`, English fallback). **Known scope boundary:** the search/discovery results grid does not yet resolve product translations, only the single-product detail page does - see [`ARCHITECTURE.md`](ARCHITECTURE.md) §12.
- **Explicitly not built this slice:** the product-translation table itself, the seller/AI translation submission UI, the Bawi translation-approval queue, locale-aware search indexing, and translated email templates — these fill in gradually, per-feature, on top of the foundation.
- **Security/content risks (for when the full system is built):** unapproved translations reaching customers (same approval-gate discipline as product moderation — see §9.19); a translation used to inject misleading pricing/claims not present in the approved English original (translations should be diffed/reviewed against the source, not approved blind); stored-XSS via translated free text (same escaping/sanitization rule as reviews — see [`SECURITY.md`](SECURITY.md) §5).

---

## 10. Success metrics (initial)

- Number of approved, active sellers.
- GMV and commission revenue.
- Checkout completion rate (cart → paid order).
- Order defect rate (returns/refunds as % of orders).
- Seller onboarding completion rate (applied → Stripe-ready).
- Time-to-payout after order settlement.

## 11. Open questions

See [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) §"Risks" for the risk register; cross-cutting open questions (commission default rate, return window length, payout cadence) are flagged there as decisions needed before/during Phase 1.
