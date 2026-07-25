# Bawi Shopping — Implementation Plan

**Status: Phase 0 and most of Phase 1 are done.** Two vertical slices are implemented, tested, and passing (see `CLAUDE.md` for the current-phase summary). This document now tracks what's left, not a not-yet-started plan — update it as each phase progresses rather than treating it as historical.

## 1. Phased build order

Phases are sequential and each produces a working, demoable slice — not a horizontal layer (e.g., "all backend, then all frontend").

### Phase 0 — Foundations ✅ done
- Monorepo scaffold (npm workspaces + Turborepo — changed from the originally-planned pnpm, see [`DECISIONS.md`](DECISIONS.md)), shared `packages/config`, `packages/ui` (Button, Input, Select, Textarea, Checkbox, FormField, StatusBadge).
- Medusa backend scaffold with PostgreSQL (Postgres.app locally, see [`DECISIONS.md`](DECISIONS.md)), migration tooling verified end-to-end across three custom modules so far (`seller`, `seller-application`, `audit-log`).
- Test tooling verified end-to-end: Vitest + RTL + Playwright (frontends), Jest (backend, including a real-server HTTP integration pattern — see [`DECISIONS.md`](DECISIONS.md)).
- Still open from this phase: background job queue library choice, exact commission default rate, return window length, payout cadence (placeholders elsewhere in `docs/`) - needed before Phase 4/5.
- CI pipeline itself (running these commands automatically on push) is not yet set up - commands are verified to work locally but nothing runs them automatically yet.

### Phase 1 — Identity & seller foundation (mostly done)
- ✅ `authentication`: `customer` and `seller_user` actor types (previous slice), `user` (admin) actor type (this slice, using Medusa's native login - no custom module needed).
- ✅ `customers`: registration (previous slice).
- ✅ `sellers`: `Seller`/`SellerUser` models (previous slice), now extended with `email`/`activation_token` for the activation flow (this slice).
- ✅ `seller-application` (this slice): public application intake, admin review queue with status filters, approve/reject with audit logging, account activation. Implemented as its own module, separate from `seller` (see [`ARCHITECTURE.md`](ARCHITECTURE.md) §4, [`DECISIONS.md`](DECISIONS.md)).
- ✅ Admin portal (`apps/admin`) exists and is authenticated - built as a full Next.js app on the shared design system, not a Medusa Admin Extension (see [`DECISIONS.md`](DECISIONS.md)).
- ❌ Not yet built: Stripe Connect Express linking (the rest of "seller onboarding" - see [`MARKETPLACE-FLOWS.md`](MARKETPLACE-FLOWS.md) §2.2). An approved, activated seller can log in today but isn't "live" for Stripe purposes yet.

### Phase 2 — Catalog (in progress)
- `categories`, `catalog`/`products`/`product-variants`, `inventory`, `pricing`, plus the new custom `product-listing` module (vendor ownership, approval status, permanent `product_code`).
- Seller portal: create/edit/publish products. Storefront: category and product detail pages (no search/cart yet — direct links only).
- **Also building this phase:** the i18n foundation (`packages/i18n`, locale selector/persistence, English-fallback lookup — see [`ARCHITECTURE.md`](ARCHITECTURE.md) §12, [`PRD.md`](PRD.md) §9.24) — infrastructure only, not full translations, deliberately built now before the number of pages grows.
- **Explicitly not in this phase:** private-fulfillment mechanics (fulfillment/pickup/tracking codes, courier role, QR codes), checkout, payments, returns — see [`PRD.md`](PRD.md) §9.23 and the risk entries below.

### Phase 3 — Discovery
- `search` module (Postgres FTS adapter behind the interface), storefront browse/search/filter UI.

### Phase 4 — Cart, checkout, payments, order splitting
- `cart`, `checkout` workflow, `payments` (Stripe Connect, Separate Charges and Transfers), `commissions`, `orders`, `vendor-order-splitting`.
- This is the highest-risk phase (see §2) and the recommended first vertical slice target — see §3.
- **Blocking prerequisite: merchant-of-record must be finalized before this phase starts.** Whether Bawi or each vendor is the legal seller of record affects who's on receipts/tax documents, refund/chargeback liability, and Stripe Connect account structure - this is a business/legal decision, not an engineering default to guess at (see [`DECISIONS.md`](DECISIONS.md), [`SECURITY.md`](SECURITY.md) §11).

### Phase 5 — Fulfillment & post-purchase
- `shipping`, seller portal order management (view/fulfill/ship), `returns`, `refunds` (with commission reversal), `payouts` (batch job in `apps/workers`).
- **Private-vendor-fulfillment model applies here**, not as a bolt-on: separate temporary fulfillment/pickup/tracking codes per order, pickup codes single-use and expiring on collection, vendors seeing only product/size/quantity/prep-deadline/pickup-instructions, a `courier` role scoped to its one assigned delivery, no direct seller↔customer contact, returns routed through Bawi rather than a vendor's address, and a pickup-location model that supports either direct vendor pickup or a future Bawi sorting hub (see [`PRD.md`](PRD.md) §9.23, [`SECURITY.md`](SECURITY.md) §11, [`ARCHITECTURE.md`](ARCHITECTURE.md) §11).

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
| ~~Seller-application approval isn't fully atomic~~ — **resolved.** Approve/reject now run as Medusa workflows with compensating rollback (`apps/backend/src/workflows/{approve,reject}-seller-application.ts`) | Technical | Fixed before the product-catalog slice began (explicitly required as a prerequisite); the same pattern was reused for product-listing approve/reject. See [`DECISIONS.md`](DECISIONS.md) |
| Approval idempotency has a narrow race window under true concurrent requests (two simultaneous approve calls could both pass the "not yet approved" check before either writes `seller_id`) | Technical | Sequential retries (the realistic case: double-click, network retry) are fully handled; genuine concurrent double-approval is a documented residual risk, not yet guarded by a DB-level lock or unique constraint |
| No email/notification service exists yet, so the seller-application approval flow surfaces the activation link directly in the admin UI instead of emailing the seller | Product / UX | Explicit, documented stand-in (see [`DECISIONS.md`](DECISIONS.md)) - revisit once the Notifications module (Phase 6) ships |
| Seller-application spam/abuse (repeated submissions from bots) has no rate-limiting or CAPTCHA yet - only same-email-while-pending dedup | Security | Acceptable for v1 given no production traffic yet; add basic rate-limiting before real public launch |
| Merchant-of-record is undecided, and Phase 4 (payments) cannot start correctly until it is | Business / Legal (open) | Explicitly flagged as a Phase 4 blocking prerequisite (see above); nothing in Phase 2/3 should assume an answer either way |
| Private-fulfillment model (fulfillment/pickup/tracking codes, courier role, QR codes) is fully decided but entirely unbuilt - a future slice must retrofit it onto whatever order/shipping schema Phase 4/5 produces | Technical / Product | Decided ahead of time specifically to avoid a rework - Phase 4/5 must design orders/shipping with resolvable per-order pickup location and vendor-info-scoping from the start, not add it after the fact (see [`PRD.md`](PRD.md) §9.23) |
| i18n foundation is built ahead of full translations - a real risk is the foundation being designed too narrowly (e.g., assuming English string length, or a locale list that's hard to extend) and needing rework once more pages/features are translated | Technical | Foundation built in Phase 2 deliberately before the page count grows; message-catalog structure and fallback logic are app-agnostic (`packages/i18n`) specifically so later phases adopt it rather than reinvent it (see [`ARCHITECTURE.md`](ARCHITECTURE.md) §12) |

## 3. Original first vertical slice, and what actually shipped

The original plan called for one seller/one product/one customer/one paid order as the first slice. What actually shipped first was narrower and more foundational: **authentication** (customer registration, seller login), then **seller application → admin approval → activation**. That reordering was deliberate given where the biggest unknowns turned out to be (tenant isolation, the actor-type auth model, and now the admin actor type + audit logging) - each is a prerequisite for the payment/order slice to be meaningful to test at all (you need real sellers and customers before "one paid order" means anything).

### Recommended next vertical slice

With identity, seller applications, and admin review now in place, the next slice should be **catalog**: a seller can create and publish one product (with one variant, price, and inventory count) from the seller portal, and a customer can view it on the storefront via a direct link (no search yet). This is the natural next step because:
- It's required before the "one seller, one product, one customer, one paid order" slice from the original plan can proceed.
- It exercises the `product`/`inventory`/`pricing` native Medusa modules extended with `vendor_id` scoping, which is a different vendor-isolation surface than auth (this time it's about a seller only ever editing their own products, not their own session) - so it's still meaningfully de-risking, not just repeating what's proven.
- It doesn't require Stripe Connect, keeping scope tight.

After catalog: checkout/payments/order-splitting (the original Phase 4, still the highest-risk remaining phase), then Stripe Connect account linking to complete seller onboarding.

## 4. Non-actions requiring confirmation first

Now that two vertical slices are built, these are no longer blanket restrictions but still require the same confirm-first discipline as any other risky action:

- Destructive database operations (dropping/truncating tables with real data) - always confirm first, even in local dev once it stops being throwaway fixture data.
- Creating a real (non-test-mode) Stripe account or using live credentials of any kind.
- Any schema migration that isn't purely additive (column/table drops) - flag and confirm per `docs/DATABASE.md` §6.
