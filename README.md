# Bawi Shopping

A multi-vendor fashion marketplace (Medusa + PostgreSQL backend, Next.js storefront/seller-portal/admin frontends). See [`CLAUDE.md`](CLAUDE.md) for the full architecture rundown and [`docs/`](docs/) for product/architecture/decisions documentation.

## Prerequisites

- Node.js >= 20
- A local PostgreSQL 16 instance. This project uses [Postgres.app](https://postgresapp.com/) rather than Homebrew — see [`docs/DECISIONS.md`](docs/DECISIONS.md) for why. Any Postgres 16 instance works; adjust connection strings below to match yours.

## First-time setup

1. **Install dependencies** (root, npm workspaces):
   ```
   npm install
   ```

2. **Create local databases** (adjust host/port/user to match your Postgres):
   ```
   psql -h 127.0.0.1 -p 5544 -U <you> -d postgres -c "CREATE DATABASE bawi_shopping_dev;"
   psql -h 127.0.0.1 -p 5544 -U <you> -d postgres -c "CREATE DATABASE bawi_shopping_test;"
   ```

3. **Configure environment variables** — copy each app's `.env.example` and fill in real local values:
   ```
   cp apps/backend/.env.example apps/backend/.env
   cp apps/storefront/.env.example apps/storefront/.env.local
   cp apps/seller-portal/.env.example apps/seller-portal/.env.local
   cp apps/admin/.env.example apps/admin/.env.local
   ```
   For `apps/backend/.env`, also create `apps/backend/.env.test` (test-database connection + `DB_HOST`/`DB_PORT`/`DB_USERNAME` for the integration-test runner — see `docs/DECISIONS.md`). Generate real random values for `JWT_SECRET`, `COOKIE_SECRET`, and `AUTH_MFA_ENCRYPTION_KEY` — never reuse the placeholders.

4. **Run database migrations:**
   ```
   cd apps/backend
   npx medusa db:migrate
   ```

5. **Create an admin user** (for the admin portal):
   ```
   npx medusa user -e you@example.com -p <a-real-password>
   ```

6. **Get the storefront's publishable API key** and add it to `apps/storefront/.env.local` as `MEDUSA_PUBLISHABLE_KEY`:
   ```
   psql -h 127.0.0.1 -p 5544 -U <you> -d bawi_shopping_dev -c "SELECT token FROM api_key WHERE type='publishable';"
   ```

## Running the apps

Each runs on its own port; start the backend first.

| App | Command | Port |
|---|---|---|
| Backend (Medusa) | `npm run dev --workspace=@bawi/backend` | 9000 |
| Storefront | `npm run dev --workspace=@bawi/storefront` | 3000 |
| Seller portal | `cd apps/seller-portal && npm run dev -- -p 3001` | 3001 |
| Admin | `cd apps/admin && npm run dev -- -p 3002` | 3002 |

To apply for a seller account, visit the seller portal's `/apply` page. To review applications, log into the admin app at `/login` with the user you created in step 5.

## Testing

From the repo root (runs across every workspace via Turborepo):

```
npm run lint
npm run typecheck
npm run test              # unit + component tests (Vitest for frontends, Jest for the backend)
npm run test:integration   # backend HTTP integration tests against a real Postgres instance
npm run build
```

End-to-end tests (Playwright) run per-app and expect the backend already running against a migrated database:

```
cd apps/storefront && npm run test:e2e
cd apps/seller-portal && npm run test:e2e   # also covers the cross-app seller-application journey with apps/admin
cd apps/admin && npm run test:e2e
```

## Project structure

```
apps/
  backend/         # Medusa commerce backend (modules, migrations, API routes)
  storefront/      # Customer-facing Next.js app
  seller-portal/   # Seller-facing Next.js app (login, seller application, activation)
  admin/           # Admin-facing Next.js app (seller application review)
packages/
  ui/               # Shared design-system components
  config/           # Shared TypeScript config
docs/               # Product, architecture, security, and decisions documentation
```
