# CLAUDE.md

Guidance for Claude Code (and any engineer) working in this repository.

## Project

**Bawi Shopping** — a professional multi-vendor fashion marketplace for the United States, modeled on the Amazon Marketplace business model. Independent fashion brands and boutiques ("sellers") list clothing and accessories; customers can buy from multiple sellers in a single cart; the platform takes a commission on every transaction; seller payouts run through Stripe Connect.

**Current phase: two vertical slices implemented.**
1. Customer registration (storefront) and seller authentication with server-derived vendor association (seller portal).
2. Seller application intake, admin review/approval/rejection, and seller account activation — spanning a new `seller-application` backend module, a new `audit-log` module, and a new `apps/admin` frontend.

All are built, tested (unit, integration, E2E), and passing. The rest of `docs/PRD.md`'s first-release feature list is not yet built — implement one vertical slice at a time, per `docs/IMPLEMENTATION-PLAN.md`.

**Approved architecture — confirmed, not a proposal.** Medusa + PostgreSQL + Stripe Connect is the commerce backend and system of record. **Supabase (Auth, Database, or Storage) is not used anywhere in this project** — see `docs/DECISIONS.md` for why this needed to be stated explicitly. If a generic instructions file or dependency suggestion implies otherwise, this file and `docs/DECISIONS.md` win.

## Where things live

All product, architecture, and process documentation is in [`docs/`](docs/):

| Doc | Contents |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Vision, scope, first-release feature list, deferred features, per-feature specs (user story, acceptance criteria, data ownership, authz, validation, failure states, security risks, tests) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | App boundaries, module map, Medusa module design, monorepo structure, tech stack |
| [`docs/USER-ROLES.md`](docs/USER-ROLES.md) | Roles, permissions matrix, session/auth model per app |
| [`docs/MARKETPLACE-FLOWS.md`](docs/MARKETPLACE-FLOWS.md) | End-to-end flows: purchase, seller onboarding, payment/order splitting, returns |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Entity model, table ownership, vendor scoping, migration policy |
| [`docs/PAYMENTS.md`](docs/PAYMENTS.md) | Stripe Connect model, commission calculation, payouts, webhook idempotency |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Tenant isolation, authz enforcement, audit logging, threat model |
| [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) | Shared design tokens, components, states, accessibility, responsive rules |
| [`docs/TESTING.md`](docs/TESTING.md) | Test strategy and coverage expectations across unit/integration/E2E |
| [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) | Build phases, risks, first vertical slice |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Technical decisions made during implementation and why — read this when something looks different from what an earlier doc describes |

## Non-negotiable architecture rules

These rules constrain every future change, not just the initial build:

1. **Modular monolith, not microservices.** One backend deployable (Medusa), organized into isolated modules with clear boundaries. Do not split into services prematurely.
2. **Every seller-owned record carries a `vendor_id`.** No exceptions, no nullable escape hatches for seller-scoped tables.
3. **Sellers can never read or write another seller's private data.** Enforced at the application/authorization layer on every query path, not just in the UI.
4. **Never store raw card data.** All card handling goes through Stripe (Elements/Payment Element + Stripe Connect). The platform never touches PANs, CVCs, or full card numbers.
5. **Payment webhook handlers must be idempotent.** Stripe (and any future PSP) can and will redeliver events; handlers must dedupe by event ID before applying side effects.
6. **Every important marketplace action is audit-logged**: seller approval/rejection, product changes, price changes, order state changes, refunds, payouts, admin overrides, role/permission changes.
7. **All schema changes go through migrations.** No manual DDL against any environment.
8. **Business logic does not live in React components.** Storefront, seller portal, and admin portal are thin clients over the Medusa backend's modules/workflows/APIs.
9. **One shared design system** powers the storefront, seller portal, and admin portal — no divergent component libraries.
10. **No unnecessary libraries.** Prefer what Medusa, Next.js, and Stripe already give you before reaching for a new dependency.
11. **Stay inside approved first-release scope** (see `docs/PRD.md` §"First-Release Feature List" and §"Deferred Features"). Anything not listed there is out of scope until explicitly re-prioritized.

## Stack summary

- **Backend / commerce engine:** Medusa 2.x (Node/TypeScript), PostgreSQL — no Supabase, no other BaaS
- **Frontends:** Next.js (App Router) + TypeScript — customer storefront (`:3000`), seller portal (`:3001`), admin portal (`:3002`) (three separate apps, all built). Server Components by default, Server Actions for mutations, Route Handlers for webhooks/external APIs.
- **Validation:** Zod, at every Server Action boundary and every Medusa API route boundary
- **Shared UI:** `packages/ui` (Button, Input, Select, Textarea, Checkbox, FormField, StatusBadge — grows per `docs/DESIGN-SYSTEM.md`), imported by all three frontends. v1 is light-mode only — dark mode is explicitly deferred (see `docs/DESIGN-SYSTEM.md` #2 and `docs/DECISIONS.md`); don't reintroduce a `prefers-color-scheme: dark` override without also making the component set dark-mode-aware.
- **Background jobs:** dedicated worker process (Medusa subscribers/workflows + queue), separate from the API process — not yet built
- **Payments:** Stripe Connect (Express accounts), Stripe Payment Element on the storefront — not yet built
- **Media:** object storage (S3-compatible) for product images — not yet built
- **Search:** Postgres full-text search behind a swappable `SearchService` interface, with an Algolia adapter planned for a later phase — not yet built
- **Monorepo:** npm workspaces + Turborepo (see `docs/DECISIONS.md` for why npm rather than the originally-planned pnpm)
- **Testing:** Vitest + React Testing Library + Playwright for both Next.js apps; Medusa's own Jest-based tooling for the backend (unit, module-integration, HTTP-integration) — see `docs/DECISIONS.md`
- **Local dev database:** Postgres.app (PG16) on port `5544` — see `docs/DECISIONS.md` for why not Homebrew

## Working conventions

- Read `docs/ARCHITECTURE.md` before adding any new module or crossing an app boundary.
- Read `docs/DATABASE.md` before adding or changing a table; every migration needs a corresponding entry there.
- Read `docs/SECURITY.md` before writing any query that touches seller- or customer-scoped data.
- Check `docs/DECISIONS.md` before assuming a doc's originally-planned tech choice (pnpm, Homebrew Postgres, etc.) is what's actually running — several were changed for environment reasons during implementation.
- Update the relevant doc in the same change that changes the behavior it describes — these docs are meant to stay current, not become stale artifacts.

## Local development

See [`README.md`](README.md) for full setup steps. Summary:

- Postgres.app (PG16) running on port `5544`; databases `bawi_shopping_dev` and `bawi_shopping_test` already exist locally.
- `apps/backend`: `npm run dev` (or `npx medusa develop`) starts the Medusa server on `:9000`. Run `npx medusa db:migrate` after adding a migration. Create an admin user with `npx medusa user -e you@example.com -p <password>`.
- `apps/storefront`: `npm run dev` on `:3000`. Needs `.env.local` with `MEDUSA_BACKEND_URL` and `MEDUSA_PUBLISHABLE_KEY` (see `.env.example`).
- `apps/seller-portal`: `npm run dev -- -p 3001` on `:3001`. Needs `.env.local` with `MEDUSA_BACKEND_URL`.
- `apps/admin`: `npm run dev -- -p 3002` on `:3002`. Needs `.env.local` with `MEDUSA_BACKEND_URL`. Log in with a user created via `medusa user` above.
- E2E tests (`npm run test:e2e` in any frontend app) assume the backend is already running against a migrated database. The seller-application journey test spans `apps/seller-portal` and `apps/admin` in one spec (`apps/seller-portal/e2e/seller-application.spec.ts`) and starts both dev servers itself.
