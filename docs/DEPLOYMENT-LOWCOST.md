# Interim low-cost deployment (Vercel + Render/Railway + Supabase)

This is an **alternative to `docs/DEPLOYMENT.md`** (the AWS/Terraform path) for the period before real vendors and customers are onboarded. The goal is $0–~$7/mo total instead of AWS's real infrastructure cost, while validating the product. See `docs/DECISIONS.md` ("Interim low-cost hosting…") for why this is compatible with the project's "no Supabase" rule — short version: Supabase is used here **only** as a hosted Postgres connection string, never its Auth/Storage/SDK/RLS.

`infra/terraform/` is untouched and stays ready — migrating back to AWS later is a redeploy of the same Docker images plus a `DATABASE_URL`/DNS change, not a rewrite. See "Migrating back to AWS" at the bottom.

## Architecture

```
Vercel (free)                Render or Railway            Supabase (free)
┌─────────────────┐          ┌──────────────────┐          ┌──────────────┐
│ storefront :3000│──┐       │                  │          │              │
│ seller-portal    │──┼─────▶│  apps/backend    │─────────▶│  PostgreSQL  │
│ admin            │──┘      │  (Medusa API)    │          │              │
└─────────────────┘          └──────────────────┘          └──────────────┘
     3 separate                 1 web service                1 database
     Vercel projects            (Dockerfile-based)            (direct connection)
```

No Redis, no S3, no separate worker process in this interim setup — all three are already optional in the code (`apps/backend/medusa-config.ts` falls back to in-memory/local-disk when their env vars are unset), which is exactly what makes a single free/low-cost instance workable. Nothing here needs to change if/when you add them back for AWS.

## What actually changes vs. the AWS path

**Code (already done):** all three `next.config.ts` files (`apps/storefront`, `apps/seller-portal`, `apps/admin`) now skip `output: "standalone"` when `process.env.VERCEL` is set — Vercel's own build pipeline doesn't use that folder and don't need the change reverted later. Nothing else in the application changed.

**Everything else is configuration**, because the backend was already built to be host-agnostic (`DATABASE_URL`, `REDIS_URL`, `S3_*`, CORS origins are all plain env vars — see `apps/backend/.env.production.example`).

## Step 1 — Supabase (database)

1. Create a project at [supabase.com](https://supabase.com) (free tier). Pick a strong database password — you'll need it in the connection string.
2. In **Project Settings → Database → Connection string**, use the **direct connection** (`db.<project-ref>.supabase.co:5432`), **not** the "Session pooler"/"Transaction pooler" one. Medusa/Mikro-ORM keeps persistent connections and uses server-side prepared statements, which the transaction-mode pooler doesn't support — using the pooler here causes obscure query failures under load, not a clean error.
3. Your `DATABASE_URL` looks like:
   ```
   postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
   ```
4. Known free-tier limits worth planning around: the project **auto-pauses after ~1 week of no activity** (first request after a pause is slow while it wakes up — fine for validation, surprising during a demo if you haven't touched it recently), and there's a 500MB storage cap. Both are non-issues at validation-phase data volumes.
5. Do **not** install `@supabase/supabase-js` or use Supabase Auth/Storage anywhere — this project's own auth/storage layers (Medusa's `auth` module, `file-s3`/local-disk) are what's used; Supabase is only the Postgres server itself.

## Step 2 — Backend on Render (recommended) or Railway

### Render (has an actual perpetual free tier)

Pick a service name now — Render URLs are deterministic (`https://<service-name>.onrender.com`), so you can decide the backend's public URL before deploying the frontends.

**Option A — Blueprint (`render.yaml`, already in the repo root):**
1. In the Render dashboard, **New → Blueprint**, connect this repo. Render reads `render.yaml` and creates the `bawi-backend` web service.
2. Fill in every env var marked `sync: false` in the Render dashboard (Supabase `DATABASE_URL`, CORS origins once you know your Vercel URLs, Stripe test keys, etc.) — see `apps/backend/.env.production.example` for what each does.

**Option B — manual service:** New → Web Service → Docker → point at this repo, set **Dockerfile Path** = `apps/backend/Dockerfile` and **Docker Build Context Directory** = `.` (repo root — required, since the Dockerfile depends on the npm-workspaces root lockfile, see the Dockerfile's own header comment). Health check path `/health`. Then add the same env vars as above manually.

Free-tier tradeoff: the service spins down after 15 minutes of no traffic and takes ~30–60s to cold-start the next request. Acceptable for internal validation; worth knowing if a Stripe webhook or a demo hits it cold.

### Railway (no true free tier anymore, but no cold starts)

Railway now requires a ~$5/mo usage-based Hobby plan rather than an indefinite free tier. Same Dockerfile approach: New Project → Deploy from repo → set root directory to `.` and Dockerfile path to `apps/backend/Dockerfile` (Railway's Docker builder uses the configured root directory as build context) → add the same env vars via Railway's Variables tab. Use this if the Render cold-start behavior is a problem for you.

### Run migrations and create an admin user (either platform)

Both platforms offer a one-off command runner against the deployed service (Render: **Shell** tab on the service; Railway: `railway run <command>` via their CLI, scoped to the service's environment). Run, once, against the same `DATABASE_URL` as the running service:
```bash
npx medusa db:migrate
npx medusa user -e you@example.com -p <password>
```

## Step 3 — Vercel (storefront, seller-portal, admin)

Vercel URLs are also deterministic from the project name (`https://<project-name>.vercel.app`), so pick names before deploying if you want to set the backend's CORS vars up front.

For each of the three apps, **New Project → import this repo → set Root Directory** to `apps/storefront`, `apps/seller-portal`, or `apps/admin` respectively (Vercel builds each as an independent project pointed at a subdirectory of the monorepo; it detects the Next.js framework and handles the workspace install itself — no Dockerfile involved). Set the env vars per app:

| App | Env vars |
|---|---|
| storefront | `MEDUSA_BACKEND_URL` (your Render/Railway backend URL), `MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| seller-portal | `MEDUSA_BACKEND_URL` |
| admin | `MEDUSA_BACKEND_URL` |

`MEDUSA_PUBLISHABLE_KEY` is created from the deployed backend's admin (Settings → Publishable API Keys) once it's up and migrated — same as the AWS path, not new to this setup.

## Step 4 — close the loop

Once all four services have real URLs, go back to the backend's env vars and set `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `SELLER_PORTAL_URL`, and `COURIER_PORTAL_URL` to the actual Vercel URLs, then redeploy the backend (Render/Railway both redeploy automatically on env var changes, or trigger manually).

## Object storage (product images)

Render and Railway's free/low-cost containers have **ephemeral disk** — anything written to local disk (the default when `S3_BUCKET` is unset) can be lost on redeploy or restart. Two options, no code change either way:
- **Accept it for now.** Simplest; fine for early testing where you don't mind re-uploading a few product images occasionally.
- **Use Cloudflare R2's free tier** (10GB storage free, S3-compatible API). `apps/backend/medusa-config.ts` already supports any S3-compatible endpoint via `S3_ENDPOINT` — set `S3_BUCKET`, `S3_ENDPOINT` (R2's S3 endpoint), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto`. No code change; this is the same `authentication_method: "access-key"` path already wired for any non-AWS S3-compatible provider.

## Known limitations of this interim setup

- **Vercel's Hobby (free) plan** is intended for personal/non-commercial use per Vercel's own terms. Fine for a private validation phase with no real customers; plan to upgrade to a paid Vercel plan (or move the frontends to AWS/CloudFront) once you're onboarding real vendors/customers — same trigger point as the Supabase→RDS migration below.
- **Single backend instance, no Redis** — fine at validation-phase traffic; matches this project's existing "Redis optional" design, not a new gap.
- **Render free-tier cold starts** (~30–60s) can make the first Stripe webhook delivery after idle slow; Stripe retries on timeout, so this doesn't lose events, just delays them.
- **Supabase free-tier auto-pause** after ~1 week idle — first request after a pause is slow.

## Migrating back to AWS later

When you're ready to onboard real vendors/customers:
1. `terraform apply` in `infra/terraform/` (already audited and hardened — see `infra/terraform/DEPLOYMENT-SEQUENCE.md`) to provision RDS, ECS, ALB, etc.
2. Migrate data: `pg_dump` from Supabase's direct connection, restore into the new RDS instance.
3. Push the same Docker images (already built for all 4 apps, unchanged) to ECR and let ECS run them instead of Render/Railway.
4. Repoint DNS from the Vercel/Render URLs to the ALB/CloudFront the Terraform module provisions.

No application code changes are required for this migration — it was a deliberate property of keeping every external dependency env-var-driven, not something added just for this doc.
