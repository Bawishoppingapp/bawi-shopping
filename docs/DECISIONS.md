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
