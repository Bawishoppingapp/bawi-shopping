# Bawi Shopping — Technical Decisions

A running log of decisions that aren't obvious from reading the code, in the order they were made. Newest at the bottom.

---

## Commerce backend stays Medusa; Supabase is not used

**Date:** first implementation session (user registration vertical slice).

**Decision:** Medusa + PostgreSQL remains the commerce backend and system of record, exactly as specified in `docs/ARCHITECTURE.md` and `docs/DATABASE.md`. **Supabase Auth, Supabase Database, and Supabase Storage are not used anywhere in this project.**

**Why:** A separate, generic "Project Instructions" template was supplied mid-project assuming a Supabase-based stack (Supabase Postgres + Auth + Storage, a single Next.js app under `src/features`). That conflicts directly with the already-decided architecture: Medusa owns its own Postgres schema via its own module system and its own `auth` module (customer/seller_user/admin actor types), which is structurally incompatible with Supabase owning identity and enforcing access via Postgres RLS. The user was asked and explicitly chose to keep Medusa.

**How to apply:** If a future instructions file, template, or dependency suggestion mentions Supabase (or any other backend-as-a-service for auth/db/storage), treat it as inapplicable to this project unless the user explicitly says otherwise. Non-backend conventions from that instructions file (Zod for validation, Vitest/RTL/Playwright for tests, `src/features` organization, Server Components by default, Server Actions for mutations) do still apply and don't conflict with Medusa — only the identity/data-ownership layer was in question.

---

## `seller_user` is a custom Medusa auth actor type, not a separate identity provider

**Decision:** Sellers authenticate through Medusa's own `auth` module using a third actor type, `seller_user`, alongside Medusa's native `customer` and `user` (admin) actor types. There is no separate auth provider (Auth0, Supabase Auth, custom JWT issuer, etc.) for sellers.

**Why:** Medusa v2's auth module is actor-type-agnostic by design — `/auth/:actor_type/:auth_provider/*` works for any actor type string without extra registration. The only real work is linking a freshly-created `auth_identity` to our own business entity (`SellerUser`, in the custom `seller` module) via `app_metadata.seller_user_id`. Once that link exists, Medusa's own JWT issuance (`generateJwtTokenForAuthIdentity` in `@medusajs/medusa`) sets the token's `actor_id` claim directly to that `seller_user_id` — so `req.auth_context.actor_id` in an authenticated request *is* the `SellerUser` row's id, with no extra resolution step needed.

**How to apply:** Any future actor type (e.g., a hypothetical `affiliate` or `support_agent`) should follow the same pattern: a custom module owning the business entity, a `POST` flow that registers the auth identity and then sets `app_metadata.<actor_type>_id`, and route-level `authenticate(actorType, [...])` middleware (see `apps/backend/src/api/middlewares.ts`) scoping access.

---

## Vendor scoping for sellers: server-derived, never client-supplied

**Decision:** The seller portal never sends or trusts a `vendor_id`/`seller_id` from the client. Every seller-scoped request re-derives it server-side from the authenticated session via `GET /seller/me` (`apps/backend/src/api/seller/me/route.ts`), which reads `req.auth_context.actor_id` and looks up the corresponding `SellerUser` → `Seller`.

**Why:** This is the core tenant-isolation guarantee in `docs/SECURITY.md` §2. Verified with an integration test asserting seller A's valid session/token never resolves to seller B's vendor record, even though both exist in the same database.

**How to apply:** Every future seller-scoped Medusa API route must resolve `vendor_id` this same way (from `req.auth_context`, via the `seller` module's service) — never accept it as a path/query/body parameter for a seller-actor caller.

---

## Monorepo tooling: npm workspaces, not pnpm

**Decision:** The monorepo uses **npm workspaces** (root `package.json` `"workspaces"` field) instead of the originally-planned pnpm + Turborepo. Turborepo itself is still used, installed as a root devDependency and invoked via `npm run <script>` → `turbo run <script>`.

**Why:** The development machine's Homebrew installation (needed to install `pnpm` globally) is owned by a different macOS user account, and reassigning that ownership (`sudo chown`) would affect another person's environment — an action outside what this session should take unilaterally. npm ships with Node and required no additional system-level install.

**How to apply:** Use `npm install`, not `pnpm install`. Per-workspace commands use `npm run <script> --workspace=<name>` or `-w <name>`. If `pnpm` becomes available in a given environment later, migrating is possible but not required — npm workspaces satisfy every requirement in `docs/ARCHITECTURE.md` (single lockfile, per-app `package.json`, shared `packages/*`).

---

## Local Postgres: Postgres.app, not Homebrew

**Decision:** Local development Postgres runs via **Postgres.app** (a self-contained `/Applications` bundle, PG16), listening on port `5544`, with its own data directory at `~/.local/share/bawi-postgres`, `trust` auth for the local user.

**Why:** Same Homebrew-ownership constraint as above — `brew install postgresql` would have required `sudo chown` on another user's Homebrew prefix. Postgres.app needs no Homebrew and no sudo.

**How to apply:** Local `DATABASE_URL`s point at `postgresql://<user>@127.0.0.1:5544/<dbname>`. Two databases exist locally: `bawi_shopping_dev` and `bawi_shopping_test`. A teammate on a machine with working Homebrew access can use a standard `brew install postgresql@16` setup instead — nothing in the app depends on Postgres.app specifically, only the port/connection string in each `.env*` file.

**Update:** `max_connections` was raised from the default `100` to `300` in `~/.local/share/bawi-postgres/postgresql.conf` (requires a `pg_ctl restart -o "-p 5544 -k /tmp"` to take effect) while diagnosing an unrelated `@medusajs/test-utils` hang - see the workflow-atomicity decision below. Left at 300 going forward since it costs nothing locally and gives headroom for future in-process test tooling that opens many pools at once (Medusa's full app loader registers a separate connection pool per core module).

---

## A single React version across the monorepo, except Medusa's admin dashboard

**Decision:** The workspace root pins `react`/`react-dom` to `19.2.4` (matching both Next.js apps) as explicit root `devDependencies`. `apps/backend`'s own React 18 requirement (for `@medusajs/dashboard`, the admin UI bundler) resolves to its own nested `node_modules/react@18` and does not affect the root.

**Why:** Without an explicit root pin, npm's hoisting picked React 18.3.1 for the root (to satisfy the backend's admin-dashboard tooling, discovered first), which meant any workspace-hoisted testing tool (`@testing-library/react`) silently resolved React 18 while the actual Next.js apps' own code resolved their local React 19 — two React copies in one test run, breaking rendering with a cryptic "Objects are not valid as a React child" error with no meaningful stack trace pointing at the real cause.

**How to apply:** Don't remove the root-level `react`/`react-dom` devDependency pin without re-testing `apps/storefront` and `apps/seller-portal`'s Vitest suites — that pin is what keeps the frontend apps' React resolution consistent with their test tooling. `packages/ui` also carries an explicit `react`/`react-dom` devDependency for the same reason (shared UI components must resolve the same React copy the consuming app uses).

---

## `ajv` pinned at the workspace root

**Decision:** Root `devDependencies`/`overrides` pin `ajv` to `^8.17.1`.

**Why:** Medusa's own migration tooling (`@mikro-orm/migrations` → `umzug` → `@rushstack/ts-command-line` → `ajv-draft-04`) requires `ajv` v8's export map (`ajv/dist/core`). Without a root-level pin, a different tool in the workspace (most likely ESLint's own dependency chain) hoists `ajv` v6 to the root, and `ajv-draft-04` — which sits at the same node_modules level — resolves that v6 copy instead, breaking any command that touches Medusa's migrator (including `apps/backend`'s Jest-based integration tests, which load `@medusajs/utils` for `loadEnv`).

**How to apply:** If `apps/backend`'s tests start failing with `Cannot find module 'ajv/dist/core'` again after a dependency change, check this pin is still in the root `package.json` first before debugging further.

---

## Backend tests use Jest; frontend tests use Vitest

**Decision:** `apps/backend` keeps Medusa's own scaffolded Jest setup for its tests (unit + module-integration + HTTP-integration, per `docs/TESTING.md`'s levels). `apps/storefront` and `apps/seller-portal` use Vitest + React Testing Library for unit/component tests and Playwright for E2E, per the Project Instructions' testing stack.

**Why:** Medusa v2's own tooling (`@medusajs/test-utils`, migration test helpers, the `medusa` CLI's test scaffolding) is built around Jest; fighting that to force Vitest into the backend would add friction for no real benefit. The frontend apps have no such constraint, so they use the stack the user specified.

**How to apply:** Don't try to unify these into one test runner — the split is intentional and matches each side's actual framework conventions.

---

## Backend HTTP integration tests boot a real `medusa develop` child process, not `@medusajs/test-utils`' bootstrap

**Decision:** `apps/backend/integration-tests/http/seller-auth.spec.ts` starts the actual Medusa server as a child process (`integration-tests/http/test-server.js`, using `medusa develop` against the `bawi_shopping_test` database) and talks to it over real HTTP, rather than using `medusaIntegrationTestRunner` from `@medusajs/test-utils`.

**Why:** `@medusajs/test-utils`' bootstrap manages its own ephemeral-database lifecycle assumptions (via `pg-god`, expecting `DB_HOST`/`DB_PORT`/`DB_USERNAME` env vars for an *admin* connection separate from the app's own `DATABASE_URL`) that didn't line up cleanly with this project's local Postgres.app setup, and use of a `medusa develop`-forced `NODE_ENV=development` inside its own bootstrap defeated a `NODE_ENV=test`-gated approach for exposing test-only routes. The child-process approach exercises the exact same code path production traffic would (real HTTP, real signed JWTs, real Postgres) and was more reliable to get working correctly than fighting the test-utils bootstrap's environment assumptions.

**How to apply:** Two test-only API routes exist solely to support this: `POST /seller-test-support/provision` and `GET /seller-test-support/publishable-key` (`apps/backend/src/api/seller-test-support/`). Both are gated on `process.env.ENABLE_TEST_SUPPORT_ROUTES === "true"` (not `NODE_ENV`, since `medusa develop` forces `NODE_ENV=development` regardless of what's passed in) and return 404 otherwise. Any new backend integration test should reuse `test-server.js` rather than reintroducing `@medusajs/test-utils`' bootstrap, unless someone specifically resolves the env-timing issue described above.

---

## `"use server"` files may only export async functions

**Decision:** Constants and non-function state (`initialRegisterState`, `CUSTOMER_SESSION_COOKIE`, and the seller-portal equivalents) live in a plain `constants.ts` file per feature, separate from the `actions/*.ts` files that carry the `"use server"` directive.

**Why:** Discovered via a failing E2E test, not by inspection: a file marked `"use server"` may only export async functions — every other export type breaks Next.js's client-reference generation for that module, and the failure mode is a confusing runtime error ("The module has no exports at all") rather than a build-time type error. This is a Next.js/React Server Functions constraint, not specific to this codebase.

**How to apply:** Any new Server Action file should export *only* async functions. Initial/default state objects, cookie name constants, and shared types belong in a sibling `constants.ts` (or similar) that both the action file and the calling Client Component import from directly.

---

## `seller-application` is its own module, separate from `seller`

**Date:** seller-application vertical slice.

**Decision:** `SellerApplication` records live in a new custom module (`apps/backend/src/modules/seller-application`), not inside the existing `seller` module. The two are linked only by a plain `seller_id` column set on the application once approved - not a hard foreign key, not a Medusa module-link.

**Why:** Explicitly required (a pending or rejected application must never be confused with, or accidentally grant access to, a real vendor record) and it also matches how Medusa itself models "intent" vs "real entity" elsewhere (e.g., `cart` vs `order`). Keeping approval as an explicit state transition between two separate tables makes "this application does not yet have vendor access" a structural fact, not just an application-logic convention.

**How to apply:** Don't add columns to `seller_application` that duplicate `seller` fields "for convenience," and don't add a real FK constraint from `seller_application.seller_id` to `seller.id` - the relationship is deliberately loose (nullable, set once, read-only after) rather than a first-class relation, because the two entities have different lifecycles and different audiences (an application's private review fields like `rejection_reason` must never leak through any relation that a seller-facing or public query might traverse).

---

## Seller account activation uses a custom token, not Medusa's password-reset flow

**Date:** seller-application vertical slice.

**Decision:** Approving a `SellerApplication` creates a `Seller` + `SellerUser` with `auth_identity_id: null` and a custom `activation_token` (32 random bytes, hex-encoded) + expiry. The seller later calls `POST /seller-activation/complete` with that token + a chosen password, which creates the `auth_identity` at that point (via `authModuleService.register("emailpass", ...)`, the same call used everywhere else in this codebase for creating a password identity) and links it to the pre-existing `SellerUser`.

**Why:** Medusa's auth module has a built-in password-reset-token mechanism (`createPasswordResetToken`/`consumePasswordResetToken`), which looked like a natural fit at first glance. It was deliberately not used: those methods are designed for a user who **already has** a password to reset, and their exact semantics for an identity that doesn't exist yet were unverified and added risk for no real benefit. The custom token reuses the exact `authModuleService.register(...)` + `app_metadata` linking pattern already proven for customer registration and seller seeding (see the `seller_user` actor-type decision above), so it only relies on Medusa APIs this codebase had already exercised successfully.

**How to apply:** If a future "resend invitation" or "reset an existing seller's password" feature is built, that's the point where Medusa's real password-reset-token flow becomes appropriate (it's designed for exactly that case - an existing identity, not a not-yet-created one). Don't conflate the two flows.

---

## No notification/email service yet: the activation link is shown directly in the admin UI

**Date:** seller-application vertical slice.

**Decision:** `POST /admin/seller-applications/:id/approve` returns the seller's activation link (`{seller-portal}/activate?token=...`) directly in the JSON response, and the admin UI displays it in a highlighted box after approving, labeled explicitly as a stand-in.

**Why:** The Notifications module (email delivery) is still in `docs/PRD.md` §8's future-phase list - building it now to send exactly one email would be scope creep for this slice. Surfacing the link in the UI keeps the flow fully usable today (an admin can copy/paste or forward it manually) without inventing a fake email integration.

**How to apply:** When the Notifications module ships, this is one of the first templates to wire up - replace the UI display with an actual email send, keep the link generation logic (`apps/backend/src/api/admin/seller-applications/[id]/approve/route.ts`) exactly as-is, since only the delivery mechanism changes, not the token/link generation.

---

## Admin portal is a full Next.js app (`apps/admin`), not a Medusa Admin Extension

**Date:** seller-application vertical slice.

**Decision:** `apps/admin` is a fourth Next.js app on the same `packages/ui` design system as the storefront and seller portal - not built using Medusa's own bundled admin dashboard framework (`@medusajs/dashboard`, its own React/Vite/react-router stack, reachable at `/app` on the backend).

**Why:** `docs/CLAUDE.md` rule #9 ("one shared design system powers the storefront, seller portal, and admin portal — no divergent component libraries") and `docs/ARCHITECTURE.md`'s original 5-app plan both already called for this. Medusa's own admin dashboard is a legitimate, faster option for pure Medusa-entity CRUD (products, orders, etc.) and remains available at `/app` for anything this project doesn't build custom UI for, but seller-application review has marketplace-specific concepts (application statuses, rejection reasons, activation links) that don't fit its native admin extension points as naturally as a purpose-built page does, and using it here would have meant the admin experience diverging from the other two apps' look and feel.

**How to apply:** Keep using `apps/admin` + `packages/ui` for anything admin-facing that's specific to this marketplace's own domain (seller applications, moderation, commissions, reporting). Medusa's native `/app` dashboard is still fine to use as-is (not to be rebuilt) for pure catalog/order/customer administration once those areas exist, since re-implementing all of Medusa's own admin CRUD screens from scratch would be wasted effort - the two can coexist.

---

## Custom `/admin/*` routes are not automatically authenticated

**Date:** seller-application vertical slice.

**Decision:** `apps/backend/src/api/admin/seller-applications/*` routes are explicitly protected via `authenticate("user", ["bearer", "session"])` in `apps/backend/src/api/middlewares.ts` - the same pattern already used for `/seller/*`.

**Why:** It's tempting to assume everything under `/admin` is automatically gated by Medusa just because of the path prefix. Checked directly in `node_modules/@medusajs/medusa/dist/api/middlewares.js`: Medusa's own blanket `/admin*` matcher only applies `setSecretApiKeyContext` - every native admin route (customers, products, etc.) wires its own `authenticate("user", ...)` individually. A custom route under `/admin` that skips this is unauthenticated by default, not secure by default.

**How to apply:** Any new custom route under `/admin/*` must add its own `authenticate("user", ...)` entry in `middlewares.ts` - never assume the path prefix alone provides protection. This was verified with an integration test (unauthenticated request to `/admin/seller-applications` returns 401) and an E2E test (visiting `/applications` in `apps/admin` without a session redirects to `/login`).

---

## `model.json()` columns need a type assertion for array data

**Date:** seller-application vertical slice.

**Decision:** `SellerApplication.product_categories` (a `string[]` in practice) is typed by Medusa's model builder as `Record<string, unknown>` (the generic shape for `model.json()`), so the create call casts it: `product_categories as unknown as Record<string, unknown>`.

**Why:** The underlying Postgres column is a plain `jsonb` that happily stores an array; Medusa's TypeScript types for `model.json()` just don't model "this specific JSON column holds an array" - there's no narrower type available and adding a whole custom column type for one array field wasn't worth it for this slice.

**How to apply:** Any future `model.json()` column that stores an array (not a plain object) will need the same cast at the point of creation. This is a known, narrow gap in Medusa's typings, not a sign of a modeling mistake.

---

## v1 stays light-mode only, everywhere - `prefers-color-scheme: dark` removed from all three apps

**Date:** seller-application vertical slice (found during manual browser verification, not by inspection).

**Decision:** Removed the `@media (prefers-color-scheme: dark)` block from `globals.css` in `apps/storefront`, `apps/seller-portal`, and `apps/admin`. All three now render in light mode regardless of OS/browser preference.

**Why:** `docs/DESIGN-SYSTEM.md` §2 already said dark mode is deferred past v1 - but the Next.js scaffold's default `globals.css` includes a dark-mode media query that flips the page *background* to near-black while `packages/ui` components (`Input`, `Button`, etc.) use fixed `text-neutral-900`-on-white-ish classes that don't adapt. The combination produced a real, hard-to-read screen (dark background, near-black text) in any browser/OS set to dark mode - only caught by taking an actual screenshot during manual testing, not by lint/typecheck/tests. Since dark mode support isn't in scope, the fix is to stop flipping the background, not to make every component dark-mode-aware.

**How to apply:** If dark mode is ever built for real (a deliberate future decision, not this one), it needs to update `packages/ui`'s components to use theme-aware color tokens, not just restore this CSS block. Don't re-add a bare `prefers-color-scheme` override without that work happening at the same time.

---

## Seller-application approve/reject now runs as a Medusa workflow, not sequential `await`s

**Date:** before the product-catalog vertical slice (explicitly requested as a prerequisite - "make that flow atomic before the marketplace starts relying on approved seller records for products and payments").

**Decision:** `POST /admin/seller-applications/:id/approve` and `.../reject` no longer call `sellerModuleService`/`sellerApplicationModuleService`/`auditLogModuleService` directly in sequence. Each now delegates its writes to a `createWorkflow`/`createStep` saga (`apps/backend/src/workflows/approve-seller-application.ts`, `reject-seller-application.ts`). Every step that writes data has a compensation function that undoes it, so a failure partway through (seller created but seller_user creation fails, or the audit-log write fails after everything else succeeded) rolls back everything the earlier steps wrote, in reverse order, automatically.

**Why:** All three modules (`seller`, `seller-application`, `audit-log`) happen to share one Postgres connection in this project (`medusa-config.ts` has one `databaseUrl`), which made a raw shared-DB-transaction approach *technically* possible (Medusa's `MedusaService`-generated methods accept a `sharedContext` with a `transactionManager`). That was deliberately not used: it would mean reaching into another module's internal transaction manager mechanics across module boundaries, which breaks the modular-monolith principle that a module could theoretically sit behind a different datastore later (see `docs/ARCHITECTURE.md` §1). Workflows with compensation are Medusa's own documented, first-class answer to exactly this problem (verified against `@medusajs/core-flows`' own `createUserAccountWorkflow`/`createUsersStep` for the pattern), and this project's `medusa user` CLI already exercises the same workflow engine successfully, so no new infrastructure was needed.

**How to apply:** Any future multi-module write sequence that needs "all or nothing" semantics (e.g., the product-approval flow this decision was a prerequisite for) should follow the same shape: one step per module write, each returning `new StepResponse(result, compensationInput)`, with a compensation function for every step except the last (the last step's compensation would only run if a later step failed, and there is none). Keep read-only pre-checks (idempotency checks, uniqueness checks) in the API route before invoking the workflow - they don't need transactional rollback since they don't mutate anything.

**Testing note:** `@medusajs/test-utils`' `medusaIntegrationTestRunner` (which boots the full Medusa app in-process against a fresh ephemeral database) hung indefinitely in this local environment for reasons unrelated to this change - even a bare `pg-god` create/drop against the same Postgres instance succeeded in under a second, so the hang is somewhere inside the full app-loader boot against a brand-new, not-yet-migrated database, not a connection-pool or credentials problem (raising `max_connections` from 100 to 300 didn't help either - see the Postgres.app decision above, now updated to 300). Rollback correctness is instead verified through the project's existing real-server HTTP integration pattern (`apps/backend/integration-tests/http/seller-application.spec.ts`), forcing genuine step failures with a temporary `ALTER TABLE ... ADD CONSTRAINT force_test_failure CHECK (false) NOT VALID` on the target table for the duration of one request. Plain `GRANT`/`REVOKE` doesn't work for this because the app's local-dev DB role (`bawishopping`) is a Postgres superuser and bypasses privilege checks entirely - a `CHECK` constraint is enforced regardless of role. Don't reach for `medusaIntegrationTestRunner` again in this repo without first getting a minimal repro of that hang working standalone.

---

## Private-fulfillment, identity-separation, and localization requirements - documented now, built later

**Date:** immediately before the product-catalog vertical slice.

**Decision:** The following are now **approved, decided requirements** for the marketplace, captured here so the product-catalog design (and everything after it) doesn't foreclose them, even though most of the actual functionality is explicitly **not** built in the product-catalog slice:

- **Private vendor fulfillment.** Sellers fulfill their own orders, but not by shipping directly to the customer's identity - see below.
- **Vendor and customer identities remain separated.** Neither party is ever shown the other's real identity/contact details. This is a stronger, bidirectional version of the existing "seller identity must not be publicly exposed" rule in the product spec.
- **Permanent product codes.** Every product gets a permanent code, issued once, distinct from its (mutable, human-editable) slug - stable even if the product is retitled, re-slugged, or archived.
- **Private vendor SKUs.** A seller's own SKU is stored but never exposed on any customer-facing or public endpoint.
- **Temporary fulfillment codes** and **single-use, expiring pickup QR codes** - part of the future delivery/handoff flow, not built yet.
- **A `courier` role with limited order access** - sees only what's needed to complete a pickup/handoff (no customer PII beyond what a handoff requires, no seller PII, no order financials).
- **Bawi-controlled communication, tracking, returns, and packaging.** The platform is the intermediary for all buyer/seller logistics contact - there is no direct seller-to-customer or customer-to-seller channel for shipping/returns coordination.
- **Merchant-of-record is an explicitly unresolved legal/business decision.** Not decided here, not implied by anything else in this list - flagged so it isn't accidentally decided by default via whatever the payments/tax implementation ends up assuming.
- **Six supported languages:** English, Amharic, Tigrinya, Afaan Oromo, Simplified Chinese, and Spanish. **English is the fallback** whenever a translation is missing. Product translations are stored in a table **separate from the base product record** - never inline per-locale columns on `product`. **Bawi must approve** any seller-submitted or AI-generated product translation before it's shown to customers (same shape as product approval itself - translations are content, and content is moderated).

**Why:** This is the platform's core trust/privacy model (comparable to how food-delivery and gig-logistics platforms keep restaurant and customer contact details from each other) plus its target-community localization requirement (serving Amharic/Tigrinya/Oromo/Chinese/Spanish-speaking communities, not just English speakers), decided by the user ahead of building the fulfillment and localization slices so the product-catalog schema doesn't have to be reworked later to accommodate them.

**How to apply - what changes now vs. later:**
- **Changes now (product-catalog slice):** the `product` table gets a permanent `product_code` column (distinct from `slug`), and any per-variant seller SKU is treated as private data - never returned from a public/storefront-facing endpoint, same tier of sensitivity as `seller_application.rejection_reason`. The product schema does **not** grow per-locale columns - if/when translations are built, they land in their own table keyed by `product_id` + `locale`.
- **Documented, not built, in this slice:** delivery/fulfillment execution, temporary fulfillment codes, pickup QR codes, the `courier` role/portal, Bawi-mediated communication/tracking/returns/packaging, the translation UI/approval workflow, and the merchant-of-record decision. See `docs/PRD.md` §8 and the new deferred feature-spec subsections, `docs/USER-ROLES.md` §2.7, `docs/SECURITY.md` §11, and `docs/ARCHITECTURE.md` §4 module map for where each now has a placeholder.
- Don't design the product-catalog slice's authorization/response shaping in a way that would leak seller identity to customers or customer identity to sellers beyond what's already required for order fulfillment once that slice exists - the identity-separation rule is already in effect even though the fulfillment system that depends on it isn't built yet.

---

## Private-vendor-fulfillment model elaborated: order-level codes, per-role information scoping, sorting-hub flexibility

**Date:** immediately after the entry above, same pre-product-catalog window - the user formalized the model with more operational detail before implementation continued.

**Decision:** Refines (does not replace) the entry above. Bawi Shopping is a **private-vendor-fulfillment marketplace**: customers shop only from Bawi Shopping, never directly from a vendor. Elaborated rules:

- **Bawi controls**, not vendors: product listings, pricing, customer service, tracking, returns, receipts, and vendor communication.
- **Three distinct order-level codes** (not one) once orders exist: a temporary **fulfillment code**, a temporary **pickup code**, and a temporary **tracking code** - each scoped to its own purpose, none of them the permanent `product_code`.
- **Pickup codes are single-use and expire on collection** (event-based expiry - consumed the moment pickup is confirmed - not just a fixed time-based TTL).
- **Vendors receive, per order, only:** product, size, quantity, a preparation deadline, and pickup instructions. Never the customer's name, contact details, payment information, or delivery address.
- **Couriers receive only** the pickup and delivery information needed for their one assigned delivery - not broader account/order access.
- **Seller-facing APIs must never return customer delivery information** - not "filtered by default," an absolute rule to design and test against from the first order-related endpoint onward.
- **Vendor IDs stay server-side and private** - already this project's standing rule (`docs/SECURITY.md` §2), reaffirmed here specifically because it's what keeps a vendor from being identifiable to a customer through an API response.
- **All sensitive access and status changes are audit-logged** - reaffirms CLAUDE.md rule #6, extended explicitly to fulfillment-code issuance/consumption once that's built.
- **Returns are handled through Bawi**, never by giving a customer a vendor's address directly.
- **The architecture must support either direct courier pickup from the vendor or a future Bawi-operated sorting hub** - i.e., don't hard-code "courier always picks up at the vendor's address" into the data model; the pickup location for a given order should be a resolvable value, not an assumption baked into fulfillment-code generation.

**Why:** This is explicitly the trust model the business is built on (per the user: comparable to how gig-delivery platforms never expose restaurant/customer contact info to each other) - not a generic privacy nicety but the mechanism that lets Bawi be the merchant relationship of record for customer service, disputes, and returns regardless of which vendor fulfilled an order.

**How to apply:** Still nothing to build this slice (checkout, courier delivery, pickup QR codes, payouts, and returns remain explicitly out of scope - see `docs/PRD.md` §9.23). What changes now is how later slices must be *designed*: any future order/fulfillment schema needs separate `fulfillment_code`/`pickup_code`/`tracking_code` concepts (not one shared code), any vendor-facing order view must be built by construction to exclude customer PII (not by filtering it out after the fact), and the stock-location model already in place for this slice (`apps/backend/src/workflows/shared/default-stock-location.ts`, a single "Bawi Fulfillment Center" location) is deliberately compatible with a future sorting-hub model - it does not assume per-vendor pickup addresses. **Merchant-of-record remains an explicitly unresolved legal/business decision that must be finalized before payments are implemented** - flagged again here since it's directly load-bearing for the fulfillment model (who has legal authority over returns, who appears on receipts) and must not be implicitly decided by how the payments phase happens to be built.

---

## Multilingual support (six languages) formalized as a core requirement, with an i18n foundation built ahead of full translation

**Date:** immediately after the private-fulfillment elaboration above, same pre-product-catalog window.

**Decision:** Localization (first introduced as a deferred item in the earlier entry above) is now a **core, named requirement** with a locale list and concrete mechanics: English (`en-US`), Amharic (`am`), Tigrinya (`ti`), Afaan Oromo (`om`), Simplified Chinese (`zh-CN`), Spanish (`es`). Unlike the fulfillment/courier/QR-code items, the user asked for an **i18n foundation to be built now** (not fully translated content, but the underlying plumbing), specifically so it doesn't have to be retrofitted once the number of pages grows. See `docs/ARCHITECTURE.md` §12 and `docs/PRD.md` §9.24 for the concrete shape (locale context/provider, cookie persistence, English-fallback lookup, message-catalog file structure) and what was actually implemented this slice vs. deferred.

**Why:** The same reasoning as any cross-cutting infrastructure decision (auth, audit logging) - retrofitting locale-awareness into markup, routing, and data models after dozens of pages exist is materially more expensive than building the seam now and filling in translations incrementally per the user's own framing ("full translations may be completed gradually as each feature is built").

**How to apply:**
- One product record per product, always - translations are a side table keyed by `product_id` + `locale`, never per-locale duplicate product rows or per-locale columns on `product` (reaffirms the entry above; this is now non-negotiable, not just a schema-shape preference).
- English is the unconditional fallback at every lookup site - a missing translation renders the English string, never a blank or a raw translation key.
- Seller-submitted or AI-generated translations are never auto-published - they enter the same kind of admin-approval queue as product content itself (see `docs/PRD.md` §9.19 moderation, §9.24).
- Prices stay USD-only for this release regardless of locale - locale changes display language, not currency/units.
- Non-Latin scripts (Amharic and Tigrinya specifically use Ge'ez script) must render correctly everywhere text flows: UI, database storage, emails, and search - this is a UTF-8-throughout requirement (Postgres already defaults to UTF-8; verify email templates and any future search-index configuration don't silently assume Latin-1/ASCII).
- Layouts must not assume English-length strings - a button/menu/form built to fit an English label must not break when the same slot holds a longer Amharic or Spanish translation; this is a design-system requirement (`docs/DESIGN-SYSTEM.md` §12), not just a translation-content concern.

---

## Every session-scoped Next.js page exports `dynamic = "force-dynamic"`

**Date:** during the product-catalog vertical slice, while writing its E2E tests.

**Decision:** Every page across all three frontends that renders data scoped to the caller's session (seller product list/detail/preview, seller dashboard, admin product list/detail, admin application list/detail) now has an explicit `export const dynamic = "force-dynamic"`.

**Why:** An E2E test ("seller A is blocked from editing seller B's product") initially failed with the product detail page returning HTTP 200 and seller B's private draft content for a request made under seller A's session. Investigated as a potential real cross-tenant data leak (the highest-severity class of bug for this platform per `docs/SECURITY.md` §1) before doing anything else. Three independent checks - an isolated Node script hitting the backend directly with fresh tokens, the full backend integration-test suite, and the E2E test itself once given an explicit wait for the login redirect to complete - all confirmed the *backend* authorization was correct throughout; the failure was a Playwright test race (asserting on the target page before the login Server Action's cookie swap had fully completed), not a real vulnerability. `force-dynamic` was added anyway during the investigation as defense-in-depth: even though it turned out not to be the root cause here, rendering a session-scoped page without it leaves the door open for the browser (or a future production reverse-proxy/CDN) to cache a response for a URL whose authorized content differs per caller - exactly the shape of bug this investigation was chasing.

**How to apply:** Any new page reading `cookies()` to resolve a caller's identity and then fetching data scoped to that identity should include `export const dynamic = "force-dynamic"` as a matter of course, not only when a bug prompts it. Public, non-session-scoped pages (storefront product pages, the seller-application public status page) don't need this - the same content is correct for every viewer, so caching them is fine and even desirable.

---

## Product-discovery slice: categories reuse Medusa's native tree, search ships as a live-query adapter with no index table

**Date:** product-discovery/categories/search/filtering vertical slice.

**Decision:** Two scope calls made while implementing this slice, both narrower than the originally-sketched design:

1. **No custom category-structure module.** Medusa's native `product-category` model already has full parent/child support (`parent_category_id`, `mpath` materialized path) and native `createProductCategoriesWorkflow`/`updateProductCategoriesWorkflow`/`deleteProductCategoriesWorkflow`. The only genuinely new thing categories needed was translations, so the only new module is `category-translation` (a `category_id` + `locale` side table, English implicit via the native `name` - same shape as the deferred `product_translation` table). Admin category CRUD composes the native category workflows as steps inside this project's own `create-category`/`update-category`/`delete-category` workflows (alongside the translation writes and the audit log), the same saga pattern as `approve-product-listing.ts`.
2. **Search v1 has no index table at all**, which is a step further than `docs/ARCHITECTURE.md` §6's original sketch (which described a Postgres tsvector/GIN-indexed table populated by `indexProduct`/`removeFromIndex` calls from event subscribers). Instead, `PostgresSearchService.searchProducts()` queries live `approved` `product_listing` rows joined against native product/variant/inventory/pricing data on every request, through Medusa's own query engine - filtering by category/vendor in Postgres, then by keyword/size/color/price/availability in application code, bounded to 500 candidate rows.

**Why:**
- For categories: building a parallel custom tree structure when Medusa already ships one battle-tested (duplicate-detection, cascade rules, cycle-safe repository methods) would have been the "unnecessary libraries/reinvention" mistake CLAUDE.md rule #10 warns against, just self-inflicted instead of a third-party dependency.
- For search: an index table is a second source of truth that can silently drift from the real approval/status data if any code path forgets to call `indexProduct`/`removeFromIndex` (a real historical class of bug in marketplace search systems - stale search results for products that are no longer live). A live-query adapter can never drift, by construction, at the cost of not scaling to a large catalog or supporting relevance ranking - both of which are exactly the triggers for swapping in a real provider (Algolia, or a ranked Postgres FTS adapter) later. The `SearchService` interface in `packages/search-contract` is what actually delivers "architecture ready for a future dedicated search provider" - the promise was about the interface boundary, not about pre-building index-maintenance machinery nothing yet needs.

**How to apply:** When a future dedicated search provider is added, write a new class implementing `SearchService` and swap it in behind `apps/backend/src/api/products/route.ts` - no caller changes. That adapter is the first code that will need `indexProduct`/`removeFromIndex`-style hooks (called from the approve/reject/update-draft workflows, the same places the old sketch envisioned event subscribers), since only then does an index exist to keep in sync.

**Pagination:** `/products` accepts and returns an opaque `cursor` string (base64-encoded offset under the hood) rather than true keyset pagination. This satisfies the "cursor-based loading" requirement from the caller's point of view (the token is opaque; nothing about it is a raw page number a client could tamper with meaningfully) while staying simple enough to implement correctly against an application-level-filtered, non-indexed result set. Revisit if/when a real search provider with native pagination support replaces the v1 adapter.

**Facets:** the `/products` response includes `facets: { sizes, colors }` reflecting every active filter *except* size/color themselves (category, brand, price, availability, keyword still apply) - so selecting one facet value never removes the other values from the dropdown, standard faceted-search behavior.

**`/brands` route (not originally speced) was added** because a real "filter by brand" UI needs a list of sellers to choose from - it returns only `{slug, name}` for sellers with at least one `approved` listing, never `vendor_id` or any other seller record field, mirroring the "brand = seller's public name" discipline already established for the single-product route.

---

## Two real bugs found via integration/E2E testing this slice, both fixed at the root cause

**Date:** same slice, during test-writing and verification.

**Bug 1 - test database missing a migration.** The new `category_translation` migration was generated and run against the local dev database, but an earlier attempt to also migrate the test database (`bawi_shopping_test`) used a shell `DATABASE_URL=$(grep ... .env.test)` extraction that silently picked up the wrong value, so the migration never actually ran there. The first integration test that exercised `GET /admin/categories` (which joins in `category_translation`) failed with a real Postgres `relation "category_translation" does not exist` (`TableNotFoundException`), not a mocked/assumed failure. Fixed by re-running `DATABASE_URL="postgresql://bawishopping@127.0.0.1:5544/bawi_shopping_test" npx medusa db:migrate` with an explicit, correct connection string, then verifying with `psql ... \dt`.

**Bug 2 - `listProductCategories({ id })` with no explicit `select` silently returns a near-empty object.** The admin `GET /admin/categories/:id` route (and the existence-check reads inside `PUT`/`DELETE`) called `productModuleService.listProductCategories({ id: req.params.id })` with only a filter, no `select`/config argument - Medusa's list method in this shape returns objects with only `id` populated (and any relation-graph defaults), silently dropping `name`, `handle`, `parent_category_id`, `is_active` (all `undefined`, so `JSON.stringify` dropped them from the API response entirely rather than erroring). This was invisible in the integration tests (which mostly assert on POST/PUT *inputs* and re-fetch via the list route, which *does* pass an explicit `select` and worked correctly) and only surfaced through a real browser E2E run: editing a child category's translations pre-selected "No parent (top-level)" in the parent dropdown (because `initialValues.parent_category_id` was `undefined`), and saving would have silently detached the category from its parent by sending an explicit `parent_category_id: null` - a real data-loss bug that unit/integration tests alone did not catch. Fixed by adding the same explicit `select: ["id", "name", "handle", "parent_category_id", "is_active"]` used by the working list route to all three call sites in `apps/backend/src/api/admin/categories/[id]/route.ts`, then re-verified live in a browser (create parent → create child → edit child's translation → confirm the parent link and the translation both persisted correctly) before re-running the full E2E suite.

**Why this is worth recording:** neither bug was caught by unit tests (both are integration-boundary issues - a real Postgres schema state, and a real Medusa ORM query-shape default) and the second was only caught by *watching real rendered UI state in a browser*, not by asserting on API JSON shape alone. Backend integration tests proved the API *inputs* worked; they didn't prove the admin *UI* read its own API responses correctly. This is why this slice's verification included a live `Claude_Browser` walkthrough of the admin category edit flow in addition to Playwright E2E, not just automated test suites - and it's a concrete argument for keeping `select` explicit on every `listX` call that feeds a UI form's pre-filled state, not just on the ones already known to need it.

**How to apply:** Never call a Medusa `listX`/`retrieveX` method without an explicit `select` (or `fields`) when the result will be used to populate more than an existence check - relying on "no select means all fields" is not a safe assumption in this Medusa version. When adding a new migration, always verify it actually ran against the test database with a direct `psql \dt` check (or equivalent), not just a "Migrations completed" log line from a command whose `DATABASE_URL` was assembled indirectly (shell substitution, `.env` parsing) rather than passed literally.
