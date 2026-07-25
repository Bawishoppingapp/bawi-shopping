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

## 5. CI gates

- Every pull request runs: lint, type-check, unit tests, and integration tests against a fresh disposable database — all required to pass before merge.
- E2E tests run on every PR for the core flows (purchase, onboarding) and on a scheduled/nightly basis for the full suite, to keep PR feedback fast while still catching regressions across the full journey set regularly.
- A merge is blocked if a migration is added without a corresponding entry in [`DATABASE.md`](DATABASE.md) and without integration tests covering the new/changed table's access patterns (tenant-scoping tests in particular).

## 6. Tooling (to finalize during Phase 1 setup, not before)

Concrete framework choices (test runner, browser automation tool, test-database provisioning method) are selected during [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) Phase 1 setup, favoring whatever integrates most directly with Medusa's and Next.js's existing tooling over introducing a new framework — consistent with the "no unnecessary libraries" rule.
