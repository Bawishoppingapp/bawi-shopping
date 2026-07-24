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

## 5. CI gates

- Every pull request runs: lint, type-check, unit tests, and integration tests against a fresh disposable database — all required to pass before merge.
- E2E tests run on every PR for the core flows (purchase, onboarding) and on a scheduled/nightly basis for the full suite, to keep PR feedback fast while still catching regressions across the full journey set regularly.
- A merge is blocked if a migration is added without a corresponding entry in [`DATABASE.md`](DATABASE.md) and without integration tests covering the new/changed table's access patterns (tenant-scoping tests in particular).

## 6. Tooling (to finalize during Phase 1 setup, not before)

Concrete framework choices (test runner, browser automation tool, test-database provisioning method) are selected during [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) Phase 1 setup, favoring whatever integrates most directly with Medusa's and Next.js's existing tooling over introducing a new framework — consistent with the "no unnecessary libraries" rule.
