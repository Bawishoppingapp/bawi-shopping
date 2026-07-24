# Bawi Shopping — Implementation Plan

No packages are installed, no database is created, and no application code is written until this plan and the rest of `docs/` have been reviewed and the user gives explicit go-ahead.

## 1. Phased build order

Phases are sequential and each produces a working, demoable slice — not a horizontal layer (e.g., "all backend, then all frontend").

### Phase 0 — Foundations
- Monorepo scaffold (pnpm + Turborepo), shared `packages/config` (tsconfig/eslint), `packages/ui` skeleton with design tokens from [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).
- Medusa backend scaffold with PostgreSQL, local dev environment, migration tooling verified end-to-end (create a trivial migration, run it, roll it back).
- CI pipeline: lint, type-check, unit tests, integration tests against a disposable DB (per [`TESTING.md`](TESTING.md)).
- Decisions to lock in this phase: background job queue library, E2E browser tool, exact commission default rate, return window length, payout cadence (all currently placeholders in other docs).

### Phase 1 — Identity & seller foundation
- `authentication` (three actor types), `customers`, `sellers`, `seller-onboarding` (application review + Stripe Connect Express linking, test mode).
- Admin portal: seller application review queue. Seller portal: registration → application → Stripe onboarding → "not live yet" state.

### Phase 2 — Catalog
- `categories`, `catalog`/`products`/`product-variants`, `inventory`, `pricing`.
- Seller portal: create/edit/publish products. Storefront: category and product detail pages (no search/cart yet — direct links only).

### Phase 3 — Discovery
- `search` module (Postgres FTS adapter behind the interface), storefront browse/search/filter UI.

### Phase 4 — Cart, checkout, payments, order splitting
- `cart`, `checkout` workflow, `payments` (Stripe Connect, Separate Charges and Transfers), `commissions`, `orders`, `vendor-order-splitting`.
- This is the highest-risk phase (see §2) and the recommended first vertical slice target — see §3.

### Phase 5 — Fulfillment & post-purchase
- `shipping`, seller portal order management (view/fulfill/ship), `returns`, `refunds` (with commission reversal), `payouts` (batch job in `apps/workers`).

### Phase 6 — Trust & operations
- `reviews`, `moderation`, `notifications` (email), `reporting`, `audit-logs` (though audit logging is implemented incrementally alongside every phase above, not bolted on at the end — this phase is about the admin-facing audit/reporting UI, not the logging itself).

### Phase 7 — Hardening & launch readiness
- Full E2E suite across all flows, load-test checkout/payment paths, security review pass against [`SECURITY.md`](SECURITY.md), accessibility audit against [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §8, staging soak test with Stripe test mode, production environment provisioning.

## 2. Major risks

| Risk | Type | Mitigation |
|---|---|---|
| Multi-vendor payment splitting is mechanically complex (single charge, N payouts, commission accuracy, refund reversal) | Technical | Separate Charges and Transfers pattern chosen deliberately (see [`PAYMENTS.md`](PAYMENTS.md)); dedicated Phase 4 focus; mandatory idempotency + arithmetic tests before it ships |
| Cross-seller data leakage (authorization bug exposing seller B's data to seller A) | Technical / Trust | Structural `vendor_id` scoping at every service layer + mandatory negative-authorization tests (see [`SECURITY.md`](SECURITY.md), [`TESTING.md`](TESTING.md)) — a single missed filter is the platform's single biggest reputational risk |
| Refund after payout creates a negative seller balance with no automated clawback path | Business / Financial | Documented explicitly in [`PAYMENTS.md`](PAYMENTS.md) §6 as an Admin-manual-reconciliation case for v1; revisit if refund-after-payout volume proves material |
| Oversell due to race conditions on last-unit inventory | Technical | Hard inventory reservation at checkout with DB-level locking, tested under concurrency (see [`PRD.md`](PRD.md) §9.7) |
| Seller onboarding stalls (incomplete Stripe KYC), leaving "approved but not live" sellers in limbo | Business | Clear seller-portal checklist UI; admin visibility into stalled onboarding; no code fix substitutes for this being a real, expected steady-state — the product must surface it, not hide it |
| Scope creep into deferred features during build (see [`PRD.md`](PRD.md) §8) | Process | Deferred list is explicit and reviewed at the start of each phase; anything not in the first-release feature list requires an explicit re-scoping conversation, not an in-flight addition |
| Modular monolith boundaries erode over time (modules start reaching into each other's tables directly) | Technical / Architectural | Module-link/workflow-only cross-module access is a stated rule (see [`ARCHITECTURE.md`](ARCHITECTURE.md) §5); enforced by code review, and by the boundary being real in Medusa's module system rather than just a folder convention |
| Search relevance/quality on Postgres FTS may be mediocre compared to customer expectations before Algolia lands | Product | Interface-first design (see [`ARCHITECTURE.md`](ARCHITECTURE.md) §6) means the Algolia migration is a swap, not a rewrite, when this becomes a priority |
| Undefined commission rate / return window / payout cadence defaults | Business decision (open) | Must be decided in Phase 0 — these are business inputs, not engineering defaults to guess at |

## 3. Recommended first vertical slice

Build a thin, fully-working slice through **one seller, one product, one customer, one end-to-end paid order** before broadening to the full catalog/discovery/multi-seller surface. Concretely, in order:

1. One seller can apply, get approved by an admin, and complete Stripe Connect (test mode) onboarding.
2. That seller can create and publish one product with one variant, price, and inventory count.
3. One customer can register, view that product via a direct link (no search yet), add it to cart, and complete checkout with a real (test-mode) Stripe payment.
4. Checkout produces one `Order` + one `VendorOrder` + one `CommissionLedgerEntry`, correctly split even though there's only one seller (proving the splitting code path is real, not special-cased for "one seller").
5. The seller sees the order in their portal and marks it shipped with a tracking number; the customer sees the shipment status update.
6. A single payout batch run correctly transfers the seller's net amount (item total minus commission) to their Stripe test-mode connected account.

This slice deliberately exercises the two highest-risk subsystems (payments/commission splitting, tenant-scoped data access) end to end before investing in breadth (search, multiple sellers per cart, returns, reviews, reporting). Once this slice is solid and tested, Phase 2–3 broaden the catalog/discovery surface, and the multi-seller cart case is added as a direct extension of an already-proven single-seller path rather than being built from scratch.

## 4. Explicit non-actions until sign-off

- No `npm install` / `pnpm install` beyond what's needed to scaffold and verify Phase 0 tooling choices, without a separate go-ahead.
- No database created in any environment.
- No application/business logic code written.
- No Stripe account (even test mode) created without confirmation.
