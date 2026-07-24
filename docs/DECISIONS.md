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
