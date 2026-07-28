# Bawi Shopping — Testing Strategy

## 1. Principles

- Every feature in [`PRD.md`](PRD.md) §9 ships with its three named test levels (unit, integration, E2E) before it is considered done — these are not optional follow-ups.
- Tests verify **correctness of behavior**, especially the two highest-risk properties in this system: **tenant isolation** (a seller can never touch another seller's data) and **financial correctness** (prices, commissions, refunds, payouts always compute from server-side truth). Every module that touches either gets explicit negative-path tests, not just happy-path coverage.
- Business logic lives in the Medusa backend (modules/workflows), so the large majority of meaningful test coverage lives there too — frontend tests focus on rendering/interaction correctness, not re-verifying business rules the backend already owns.

## 2. Test levels

### 2.1 Unit tests

- Scope: a single function/service method in isolation — validation rules, state-machine transitions, arithmetic (pricing, commission, rounding), pure formatting/utility functions.
- Location: colocated with source in each module (`apps/backend/src/modules/<name>/__tests__`), and in `packages/*` for shared utilities.
- No network, no real database — mocked/in-memory dependencies only.
- Required for: every validation rule and every state machine named in [`PRD.md`](PRD.md) §9 (e.g., seller status transitions, order/vendor-order status transitions, commission rate-precedence resolution, inventory reservation arithmetic).

### 2.2 Integration tests

- Scope: a module's service (or a workflow spanning a few modules) against a real, disposable PostgreSQL database (test container or equivalent) — verifies the module boundary and its DB interactions actually behave as specified, including authorization scoping.
- **Mandatory negative-authorization tests**: for every seller-scoped or customer-scoped read/write path, an integration test asserts that actor A's authenticated call cannot read or mutate actor B's data. This is a release gate for the `sellers`, `products`, `inventory`, `pricing`, `vendor-order`, `commission`, `payout`, `shipping`, `returns` modules specifically (per [`SECURITY.md`](SECURITY.md) §2).
- **Mandatory idempotency tests**: every webhook handler (Stripe events) and every workflow with a client-supplied idempotency key (checkout) has a test that replays the same event/key and asserts no duplicate side effect occurs.
- Required for: every "Integration" bullet listed per feature in [`PRD.md`](PRD.md) §9.

### 2.3 End-to-end (E2E) tests

- Scope: a full user journey through a real (or realistic staging-like) deployment of the relevant app(s) plus backend, using a browser automation tool against the actual UI.
- Covers the flows in [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md) end to end: multi-vendor purchase, seller onboarding (Stripe test mode), return/refund, and the per-feature E2E scenarios listed in [`PRD.md`](PRD.md) §9.
- Stripe test mode (test API keys, test cards, Stripe's webhook test/CLI forwarding) is used for all payment-related E2E coverage — no E2E test ever runs against live Stripe.
- Runs against all three frontends where relevant (a single marketplace journey often touches storefront + seller portal, e.g., "customer buys → seller sees and ships the order").

## 3. Test data & environments

- Integration and E2E tests run against a disposable, migration-provisioned database per test run — never against a shared persistent dev/staging database, to keep tests deterministic and parallelizable.
- Seed/fixture data (a handful of approved sellers, published products, a category tree) is defined once as a shared fixture set used by both integration and E2E suites, so scenarios stay consistent and don't drift between test levels.
- Stripe interactions in integration tests use Stripe's test-mode API directly (not a hand-rolled mock of Stripe) wherever feasible, so the tests exercise real Stripe request/response shapes; a lightweight stub is acceptable only for unit-level tests of pure logic that happens to consume a Stripe object shape.

## 4. Coverage priorities (highest risk first)

1. Tenant isolation across every seller-scoped module (§2.2 mandatory negative tests).
2. Payment/commission/payout arithmetic and idempotency (checkout, webhooks, refunds, payouts).
3. Vendor-order splitting correctness and atomicity (no captured payment without a corresponding, complete split).
4. Authorization role boundaries across all six roles in [`USER-ROLES.md`](USER-ROLES.md) (e.g., seller staff sub-roles cannot exceed their scope; admin cannot silently edit seller content).
5. Moderation/review integrity (verified-purchase gating, rejected-content re-queueing).
6. Everything else named per-feature in [`PRD.md`](PRD.md) §9.

## 4.1 Localization (i18n foundation) test requirements

Per [`PRD.md`](PRD.md) §9.24 and [`ARCHITECTURE.md`](ARCHITECTURE.md) §12 - required as the foundation lands, not deferred to a later "i18n testing" pass:

- **Unit:** the `t(key, locale)` lookup function - returns the requested locale's string when present, falls back to `en-US` when the key is missing from the requested locale, and every key present in any non-English message file also exists in `en-US.json` (a fixture-driven completeness check, not a runtime concern).
- **Integration/component:**
  - **Language switching** - selecting a language updates rendered UI strings.
  - **Language persistence** - the selected locale survives a page reload/new session (cookie read back correctly).
  - **English fallback behavior** - a locale file missing a specific key still renders the English string for that key, not a blank or a raw key name.
  - **Missing translations** - an entire locale file missing (or a key present in none of them except English) doesn't crash rendering.
  - **Non-Latin script rendering** - Amharic, Tigrinya, Afaan Oromo, Simplified Chinese, and Spanish sample strings render without mojibake/tofu-boxes (a snapshot or visual-regression check per locale is sufficient at foundation stage - full linguistic QA is a later, content-driven pass).
  - **Translated product content** - once `product_translation` exists, a product page under a non-English locale renders the matching translation row when `approved`, and falls back to the English base record when no approved translation exists for that locale.
- **E2E:** a mobile-viewport pass through at least one page with the longest-known translated strings (per [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §12) confirming no overflow/clipping of buttons, menus, or form fields.

## 4.2 Product discovery, categories, and search test requirements

Per [`PRD.md`](PRD.md) §9.5/§9.9 - implemented this slice, tested at every level rather than deferred:

- **Unit:** category cycle-detection (`wouldCreateCycle` - self-parent, direct child, grandchild, and unrelated-move cases) and tree-building (`buildCategoryTree` - nesting, multi-level, orphaned-parent handling); category create/update schema validation (translatable-locale restriction, empty-name rejection); search cursor encode/decode (round-trip, `undefined`, malformed input, negative offset).
- **Integration (real HTTP server, real Postgres):**
  - **Approved-only visibility** - draft/pending_review/rejected listings never appear in `/products` results, even when queried by their own exact title; an approved listing does; the full response never contains the strings `vendor_id` or `"sku"`.
  - **Category management** - unauthenticated create is rejected; parent/child creation and the resulting tree shape; self-parent and descendant-cycle rejection (422); translation set + read-back + English fallback; an out-of-locale-set translation key rejected (400); delete refused (409) while a category has a child or a product assigned; delete succeeds once empty.
  - **Filtering** - category, brand (seller slug), size, color, price range, and availability each independently narrow results to the expected set.
  - **Sorting** - `price_asc`/`price_desc` return items in the expected order for a controlled fixture.
  - **Pagination** - repeatedly following `next_cursor` until exhausted returns every seeded item exactly once, no duplicates or gaps.
  - **Localization** - `/categories?locale=X` returns the translated name when a translation row exists, and falls back to the category's own (English) name when it doesn't.
  - **Brands** - only sellers with at least one `approved` listing appear.
- **Component:** filter form renders category/brand/size/color/price/availability controls and omits size/color when there are no facet values; submitting updates the URL query string and clears any existing pagination cursor; "Clear all" removes filter params but preserves sort; the mobile trigger opens a drawer with a close control; sort-select updates the URL's `sort` param and clears the cursor; the search box sets/clears the `q` param on submit; product card renders title/brand/price (including a price range when min ≠ max) and a sold-out badge only when unavailable; admin's category form pre-fills correctly in edit mode (name, parent, active flag, translations) and defaults sensibly in create mode.
- **E2E:**
  - Storefront: homepage's new-arrivals rail, a category page, and search all show an approved product and never a draft one seeded moments earlier via the API; selecting a size facet narrows results to the matching product and back; changing sort updates the URL; a mobile viewport exposes the filter drawer.
  - Admin: create a parent category, create a nested child under it, edit the child's translation and confirm it persisted *without* silently detaching the parent link (the specific regression caught during this slice - see `docs/DECISIONS.md`); confirm delete is blocked while a child exists and succeeds once it's removed.
- A live-browser walkthrough (not just automated E2E) of the admin category edit flow is worth doing by hand once when this area next changes materially - the parent-link regression this slice found was only visible by watching the actual pre-filled form state, not by asserting on API JSON shape alone.

## 4.3 Stripe Connect seller onboarding and business-configuration test requirements

Per [`PAYMENTS.md`](PAYMENTS.md) §2 and [`DECISIONS.md`](DECISIONS.md) - the platform never makes a real Stripe API call in automated tests; a fake Stripe client satisfying the same minimal interface (`accounts.create`, `accountLinks.create`, `webhooks.constructEvent`) is used instead, gated the same way as the existing `seller-test-support` routes (`ENABLE_TEST_SUPPORT_ROUTES=true`), so no test requires a real Stripe key:

- **Unit:** business-config value-type coercion and `is_placeholder` bookkeeping; feature-flag default-`false` invariants; the Stripe-status-to-UI-label derivation (not connected / pending / live) is a pure function, tested without a network call.
- **Integration (real HTTP server, real Postgres, fake Stripe client):**
  - An unauthenticated or non-seller caller cannot request an onboarding link or read another seller's Stripe status.
  - Requesting an onboarding link when no Stripe account exists yet creates one and stores only `stripe_account_id` on the seller row - never a bank/identity/tax field, verified by asserting the full response/DB row never contains those keys.
  - Requesting a link again reuses the existing `stripe_account_id` rather than creating a second Stripe account (idempotent by design, not by luck).
  - `POST /webhooks/stripe` rejects a request with an invalid/missing signature before any parsing or side effect.
  - Replaying the same `event.id` twice applies the `account.updated` side effect exactly once (`processed_webhook_event` uniqueness enforced at the DB level, not only in application logic).
  - Every Stripe-status change and every `business_config_entry` write produces exactly one `audit_log` row with the real authenticated actor id - never a client-supplied value.
  - The public storefront/seller APIs never return `stripe_account_id` or any other Stripe reference in their response bodies (same "serialize and grep" discipline already used for `vendor_id`/SKU checks in the product-discovery slice).
  - The production-readiness check script reports every `is_placeholder: true` row and every `real_*`/`live_payments_enabled` flag still `false`, and exits non-zero while any placeholder remains.
- **Component:** the seller-portal onboarding banner renders the three states (not connected / pending / live) correctly from a given status prop; the admin business-config page renders every category and marks placeholder values visibly.
- **E2E:** an activated seller clicks "Connect payouts" and is redirected to a URL matching Stripe's own domain pattern (the test does not - and cannot - complete Stripe's real hosted form); a simulated `account.updated` webhook (posted directly to the test server with a validly-signed test payload) flips the seller portal's displayed status from "pending" to "live" on next load; an admin can see a seller's Stripe connection status on the sellers list.

## 4.4 Multi-vendor cart test requirements

Per `docs/PRD.md` §9.10 and `docs/DECISIONS.md` - the cart never trusts a client-supplied price/vendor-id/availability figure, and no test requires a real Stripe/tax/courier integration (checkout doesn't exist yet):

- **Unit:** quantity validation (`validateRequestedQuantity` - positive-whole-number, max-quantity, and inventory boundaries, including the "max checked before inventory" ordering); shipping-estimate and free-shipping-threshold calculation (`calculateShippingEstimate`) from business-config inputs; cart-expiration boundary logic (`isCartExpired`, including the exact-boundary and one-millisecond-past cases); `resolvePublicBrand()` never leaking the real seller name when unapproved; localization fallback (covered generically by the existing `packages/i18n` suite - new `cart.*`/`login.*` keys are asserted present in `en-US.json` and consistent across all six locale files by that same suite, not a cart-specific test).
- **Integration (real HTTP server, real Postgres):**
  - A guest can create a cart (by adding an item) and update it via the `x-cart-id` header alone; an authenticated customer can do the same via bearer token alone, with no cart-id header needed.
  - Products from two different vendors coexist in one cart, and the response never includes `vendor_id`, seller id, or any other private seller field (verified by serializing the full response and asserting the absence of those substrings, same "serialize and grep" discipline as the Stripe-onboarding tests).
  - A seller-authenticated (`seller_user`) token cannot reach `/store/cart*` - it resolves as unauthenticated (guest), never another customer's cart.
  - A client-submitted `unit_price`/`vendor_id`/`price` in the add-to-cart request body is silently ignored, not honored - the stored/returned price always comes from `resolveCartVariant()`.
  - A draft, pending_review, rejected, or archived product's variant cannot be added (404); an out-of-stock variant cannot be added (400); a quantity above live inventory or the configurable maximum cannot be added or set (400 either way).
  - A price change on the seller's product (simulated via a test-support-only route, since there's no real "edit a live listing's price" feature yet) is reflected - and persisted - the next time the cart is read, with a `price_changed` warning.
  - Inventory dropping below an already-in-cart quantity, or the product being archived after being added, flags the item (`is_available`/`quantity_exceeds_inventory`, `checkout_blocked: true`) without deleting it from the cart.
  - A guest cart merges into a new customer's cart on login/register with no duplicate line items; merging into an *existing* customer cart sums quantities per variant and caps to live inventory/the maximum; a repeated merge call for the same guest cart id is idempotent (a no-op, not a duplicate merge); merge requires an authenticated customer (401 without one).
  - After merging into an existing customer cart, a fresh `GET /store/cart` still resolves to the same (non-empty) cart - not the now-empty former guest cart (a real bug found by the post-Phase-2 audit; see `docs/DECISIONS.md`).
  - Two merge requests for the same guest cart fired concurrently (`Promise.all`, not sequentially) never duplicate line items - the true-concurrency case, distinct from the sequential-replay idempotency test above (also a real bug found by the audit).
  - A cart older than the configured `cart_expiration_days` is treated as not found - the next add-to-cart starts a genuinely new cart, not the expired one.
- **Component:** `AddToCartForm` narrows size options to the selected color, disables submission for an out-of-stock variant, and shows the resolved success/error state from the action; `CartItemRow` renders title/brand/color-size/product-code/line-total, never a `vendor_id`/`seller_id` substring anywhere in its rendered HTML, hides the quantity control and shows the right warning text for an unavailable/over-quantity/price-changed line item, and scopes a warning to its own line item id.
- **E2E:** a guest adds products from two different vendors and sees one unified Bawi cart; a guest updates a quantity and removes an item; registering with items already in the guest cart merges them into the new account without duplicates; a returning customer's authenticated cart is still there after a fresh login (cookies cleared in between, to prove it's resolved by `customer_id` and not a leftover cart-id cookie); an item that becomes unavailable after being added is clearly flagged in the UI; no vendor identity or private SKU appears anywhere in the cart UI or in a captured `/store/cart` network response body.

## 4.5 Checkout and multi-vendor order-splitting test requirements

Per `docs/PAYMENTS.md` and `docs/DECISIONS.md` - checkout never trusts a client-supplied price/amount, every Stripe operation is idempotent, and a `VendorOrder` is created only after payment capture succeeds:

- **Unit:** commission-rate resolution and round-half-up rounding (`resolveCommission` - seller override vs. platform default, zero-subtotal edge case); the mock tax adapter's flat-rate calculation and rounding (`calculateMockTax`); fulfillment-code shape/uniqueness (`generateFulfillmentCode`); the checkout request schema (`startCheckoutSchema` - required address fields, 2-letter country code, required idempotency key).
- **Integration (real HTTP server, real Postgres, fake Stripe client)** - written in `integration-tests/http/checkout.spec.ts`:
  - A cart spanning two vendors checks out into one `MarketplaceOrder` with a `PaymentIntent`; a `payment_intent.succeeded` webhook splits it into one `VendorOrder` per seller (subtotals summing back to the order total), decrements each purchased variant's live inventory by the ordered quantity, and clears the customer's cart.
  - The order-detail response never includes `vendor_id`/seller id - only the resolved public brand (verified by serializing the response and asserting the substring's absence, same discipline as the cart/Stripe-onboarding tests).
  - A duplicate `payment_intent.succeeded` delivery for the same event id does not create a second set of `VendorOrder`s or double-deduct inventory (webhook idempotency).
  - Calling `POST /store/checkout` twice with the same client-generated `idempotency_key` returns the same order rather than creating a second one/a second PaymentIntent.
  - `POST /store/checkout` and `GET /store/orders*` require an authenticated customer (401 without one - no guest checkout in v1).
  - A customer cannot read another customer's order (404, not another customer's data) - authorization/privacy.
  - A `payment_intent.payment_failed` webhook releases the inventory reservation (availability returns to its pre-checkout level) and leaves the cart intact for the customer to retry, rather than clearing it.
  - **Deferred:** this file could not be run to completion in this session due to development-machine memory pressure (confirmed unrelated to the code - see `docs/DECISIONS.md`); it passed lint/typecheck and should be re-run once the machine has more available memory or in CI.
- **E2E:** not yet added in this batch - a full storefront checkout journey (address entry through Stripe test-card confirmation to the order-confirmation page) is a natural addition once Batch 2 (fulfillment) gives the confirmation page more to show; the integration-test coverage above already exercises the same server-side paths a Playwright spec would drive through the UI.

## 4.6 Private fulfillment and delivery test requirements

Per `docs/SECURITY.md` §11/§14 and `docs/DECISIONS.md` - every code is unguessable and single-use via an atomic claim (not a status flag), and every response shaper excludes the other parties' data by construction:

- **Unit:** pickup/tracking-code shape and uniqueness (`generatePrivacyCode` - matches its expected alphabet/format, produces distinct codes across many calls).
- **Integration (real HTTP server, real Postgres)** - written in `integration-tests/http/fulfillment.spec.ts`:
  - A fulfillment order moves through the full lifecycle (preparing → ready for pickup → assigned → picked up → out for delivery → delivered), with the pickup code redeemed by the assigned courier and the delivery-confirmation code redeemed as proof of delivery.
  - A redeemed pickup code cannot be used a second time (single-use, replay protection) - the second attempt is rejected (422), not silently accepted.
  - The seller's fulfillment-order view never includes the customer's identity, shipping address, or phone number (serialize-and-assert-absence).
  - A courier cannot access an assignment belonging to a different courier (404, not another courier's data).
  - A courier's assignment view never includes the seller's real identity or the substring `customer`.
  - The customer's own order response never includes the seller-facing pickup code's value.
  - Reading an assignment's detail writes an audit-log entry (`vendor_order.assignment_viewed`, `actor_type: "courier"`) - "audit logs for sensitive access," not only for mutations.
  - **Deferred:** this file could not be run to completion in this session due to the same development-machine memory pressure documented for `checkout.spec.ts` (see `docs/DECISIONS.md`); it passed lint/typecheck and should be re-run once the machine has more available memory or in CI.
- **E2E:** not yet added in this batch - same reasoning as checkout's E2E deferral; the integration coverage above already exercises the full lifecycle across all three actor types (seller, admin, courier) plus the customer-facing read path.

## 4.7 Commission ledger, payouts, returns, refunds, and disputes test requirements

Per `docs/PAYMENTS.md` §4-7 and `docs/DECISIONS.md` - refund/reversal amounts are always server-computed, ledger buckets are derived (never stored), and every financial mutation is audit-logged:

- **Unit** (`src/finance/__tests__/balance.unit.spec.ts`, `refund-calculation.unit.spec.ts`, 16 tests): `deriveLedgerBucket()` - paid beats disputed beats available beats pending, an entry with a future `available_at` stays pending, an entry with no timestamps at all is pending; `summarizeSellerBalance()` - sums entries into their derived buckets, `refund_reversal` entries accumulate separately into `reversed` on top of their own bucket, an empty list produces an all-zero summary; `calculateRefund()` - defaults to a full refund, a partial refund reverses commission proportionally, round-half-up rounding, a requested amount above the line_total is capped there, a negative requested amount floors at zero, a zero line_total never divides by zero, `net_reversal_amount` is always `refund_amount - commission_reversal_amount`.
- **Integration (real HTTP server, real Postgres, fake Stripe client)** - written in `integration-tests/http/seller-finance.spec.ts`:
  - Checkout capture creates a pending `CommissionLedgerEntry` reflected in the seller's `/seller/finance/balance` response (net of commission, before any hold period has passed).
  - A payout batch (`POST /admin/finance/payouts`) transfers every "available" entry, marks them paid, and is idempotent - re-running the batch after a full payout finds nothing left eligible (`payout: null`).
  - An approved, customer_remorse-reason return refunds the customer (`OrderRefund` row, `stripe_refund_id` matching the fake client's `re_test_*` pattern), reverses commission proportionally (`CommissionLedgerEntry` with `reason: refund_reversal`), and restocks inventory.
  - A denied return leaves the ledger and seller balance completely untouched.
  - A pre-preparation cancellation (`POST /store/vendor-orders/:id/cancel`) issues a full refund with `return_request_id: null` and a full ledger reversal; the same action after the seller marks the order preparing is rejected (422).
  - A `charge.dispute.created`/`charge.dispute.closed` webhook pair freezes the seller's balance (moves it into the `disputed` bucket) and, on a `won` outcome, releases it back to `pending`.
  - A seller cannot see another seller's balance, payouts, or return requests (tenant-isolation negative test).
  - **A real bug was found and fixed via this test, on its first run:** nesting a `when(...).then(...)` block inside another one's callback (`apply-stripe-dispute-webhook.ts`'s two dispute-event branches) fails at workflow-definition time - fixed by flattening to two sibling top-level `when()` blocks (see `docs/DECISIONS.md`). This is exactly what this integration-test layer is for; it caught the bug lint and typecheck could not.
  - **Deferred (after the fix above):** this file could not be run to completion in this session due to the same development-machine memory pressure documented for `checkout.spec.ts`/`fulfillment.spec.ts` (see `docs/DECISIONS.md`); it passes lint/typecheck and should be re-run once the machine has more available memory or in CI.
- **E2E:** not yet added in this batch - same reasoning as checkout's/fulfillment's E2E deferral; the integration coverage above already exercises the full financial lifecycle across all three portals' API surfaces.

## 4.8 Notifications and account-completion test coverage

This batch's new logic is thin by design (see `docs/DECISIONS.md`): notifications call Medusa's own native, already-battle-tested `notification` module and a two-field dedup/inbox insert; saved addresses and admin user/invite management are pure frontend wrappers around native Medusa routes with their own existing test coverage upstream; seller-staff invites reuse the seller-application activation-token workflow pattern verified in that slice's own tests. No new pure-function module was added that would warrant a dedicated unit-test file (the templates in `src/notifications/templates.ts` are plain string interpolation, not business logic).

- **Verified this batch:** full monorepo lint (0 errors), full backend + all three frontend typechecks (clean), the full existing backend unit suite (188 tests, all passing, unaffected by this batch's changes), and production builds for all three frontends (`apps/storefront`, `apps/seller-portal`, `apps/admin`) plus the backend (`npx medusa db:migrate`, which loads every workflow file and is what caught this batch's one real bug - see `docs/DECISIONS.md`).
- **Not added this batch:** a dedicated integration-test file exercising the new notification-triggering workflow steps end-to-end, or component/E2E tests for the new `/account`, `/staff`, `/team` pages. Flagged here explicitly as a gap to close in a later hardening pass rather than silently omitted - the individual pieces are exercised by the existing checkout/return/payout/seller-application integration tests indirectly (since those workflows now also call `recordNotification()`), but there's no assertion yet that a `NotificationInboxEntry` row actually appears with the right recipient scoping.

## 5. CI gates

- Every pull request runs: lint, type-check, unit tests, and integration tests against a fresh disposable database — all required to pass before merge.
- E2E tests run on every PR for the core flows (purchase, onboarding) and on a scheduled/nightly basis for the full suite, to keep PR feedback fast while still catching regressions across the full journey set regularly.
- A merge is blocked if a migration is added without a corresponding entry in [`DATABASE.md`](DATABASE.md) and without integration tests covering the new/changed table's access patterns (tenant-scoping tests in particular).

## 6. Tooling (to finalize during Phase 1 setup, not before)

Concrete framework choices (test runner, browser automation tool, test-database provisioning method) are selected during [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) Phase 1 setup, favoring whatever integrates most directly with Medusa's and Next.js's existing tooling over introducing a new framework — consistent with the "no unnecessary libraries" rule.
