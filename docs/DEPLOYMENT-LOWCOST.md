# Interim low-cost deployment (Vercel + Render/Railway + Supabase)

This is the **staging deployment runbook** for the low-cost path — an alternative to `docs/DEPLOYMENT.md` (the AWS/Terraform path) for validating the product before real vendors/customers are onboarded. Target cost: $0–~$7/mo. See `docs/DECISIONS.md` ("Interim low-cost hosting…") for why this is compatible with the project's "no Supabase" rule — short version: Supabase is used here **only** as a hosted Postgres connection string, never its Auth/Storage/SDK/RLS.

`infra/terraform/` is untouched and stays ready — see "Migrating back to AWS" at the bottom.

**Nothing in this document turns on real money, real email/SMS, or real anything.** Stripe stays in test mode; `live_payments_enabled` and every `real_*` feature flag stay `false` throughout. See §6.

## Architecture

```
Vercel (free)                Render (free) or Railway     Supabase (free)
┌──────────────────┐         ┌──────────────────┐         ┌──────────────┐
│ storefront :3000 │──┐      │                  │         │              │
│ seller-portal     │──┼────▶│  apps/backend    │────────▶│  PostgreSQL  │
│ admin             │──┘     │  (Medusa API)    │         │  (direct     │
└──────────────────┘         └──────────────────┘         │  connection) │
   3 separate Vercel            1 web service              └──────────────┘
   projects                     (existing Dockerfile)
```

**Redis: not used, not required.** `apps/backend/medusa-config.ts` already falls back to in-memory event bus/cache/locking when `REDIS_URL` is unset — correct behavior for a single instance, which is what a free-tier deploy is. Skip it entirely for staging; nothing below provisions it. If you later want to test multi-instance behavior, a Redis add-on (Render) or Upstash's free tier both just need a `REDIS_URL` value — no code or provisioning-order change.

**Object storage: optional, decide in §5.** Local disk works but is ephemeral on Render/Railway; Cloudflare R2's free tier is the low-cost fix, no code change either way.

## §1. Accounts and credentials — everything that requires you

Nothing below can be created or entered by me. This is the complete list; nothing else in the sections that follow needs a new account.

| # | Account | Why | Cost |
|---|---|---|---|
| 1 | [Supabase](https://supabase.com) | Hosted Postgres | Free tier |
| 2 | [Render](https://render.com) (or [Railway](https://railway.app)) | Hosts the backend container | Render: free tier (cold starts). Railway: ~$5/mo, no cold starts |
| 3 | [Vercel](https://vercel.com) | Hosts the 3 frontends | Free (Hobby) tier |
| 4 | [Stripe](https://stripe.com) | Payments — **test mode only** | Free |
| 5 | (Optional) [Cloudflare](https://dash.cloudflare.com) | R2 object storage, if you don't want ephemeral local disk | Free tier (10GB) |

Credentials to collect as you go (none exist yet — generate/copy them during the steps below, don't invent them ahead of time):
- Supabase database password (you set it at project creation) → becomes part of `DATABASE_URL`
- Stripe test-mode **Secret key** and **Publishable key** (Stripe Dashboard → Developers → API keys, with "Test mode" toggled on)
- Stripe webhook **signing secret** (generated only after the backend has a real URL — see §3 step 5)
- (Optional) Cloudflare R2 access key ID/secret if you choose R2 in §5

No DNS, no custom domain, and no paid plan is required anywhere in this staging setup — Vercel and Render/Railway both issue free, working HTTPS subdomains (`*.vercel.app`, `*.onrender.com`), which is what §3–§4 use throughout.

## §2. Database — Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier). Pick a strong database password.
2. **Project Settings → Database → Connection string → URI**, tab **"Direct connection"** — **not** "Session pooler"/"Transaction pooler". Medusa/Mikro-ORM holds persistent connections and uses server-side prepared statements, which the transaction-mode pooler doesn't support (silent query failures under load, not a clean error, if you use it by mistake).
3. Your `DATABASE_URL`:
   ```
   postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
   ```
4. **TLS certificate verification needs a second, separate env var — not a `DATABASE_URL` query param.** Supabase requires TLS but presents a certificate chain Node's default strict verification rejects from a generic client (`self-signed certificate in certificate chain` — confirmed against a real failed Render deploy). A `?sslmode=...` suffix on `DATABASE_URL` does **not** fix this: Medusa's own Postgres connection loader (`@medusajs/utils`'s `createPgConnection`, confirmed against its actual source) always passes an explicit `ssl` option to the driver that overrides anything parsed from the connection string, defaulting to `ssl: false`. The real fix, already wired in `apps/backend/medusa-config.ts`: set
   ```
   DATABASE_SSL_REJECT_UNAUTHORIZED=false
   ```
   as its own env var (§3/§5's tables). Off by default — AWS RDS (`infra/terraform`) and local/CI Postgres are unaffected by this var existing.
5. Free-tier limits worth knowing: project **auto-pauses after ~1 week idle** (first request after is slow while it wakes), 500MB storage cap. Both fine at validation-phase volume.
6. Do **not** install `@supabase/supabase-js` or touch Supabase Auth/Storage anywhere — this is a bare Postgres connection string, nothing else.

## §3. Backend — Render (recommended) or Railway

Pick the service name now — URLs are deterministic (`https://<service-name>.onrender.com`), so you know the backend's public URL before deploying the frontends.

### Deploy

**Render, Option A — Blueprint (`render.yaml`, already in the repo root):**
1. Render dashboard → **New → Blueprint** → connect this repo. Render reads `render.yaml` and creates the `bawi-backend` web service.
2. Fill in every env var marked `sync: false` — see §5's tables for what each one is and where it comes from.

**Render, Option B — manual service:** New → Web Service → Docker → this repo → **Dockerfile Path** = `apps/backend/Dockerfile`, **Docker Build Context Directory** = `.` (repo root — required; the Dockerfile depends on the npm-workspaces root lockfile). Health check path `/health`. Add the same env vars manually — **including `PORT=9000`** (see below; not needed if you used the Blueprint, it's already in `render.yaml`).

**`PORT` must be pinned to `9000` explicitly** — confirmed against a real deploy that timed out on Render's health check. Medusa's `start` command reads a `PORT` env var if one is set (falling back to `9000` only when unset — confirmed against `@medusajs/cli`'s own `--port` option help text), and Render injects its own `PORT` (defaulting to `10000`) into Docker services unless overridden. Without pinning this, Medusa may bind to a different port than the Dockerfile's `EXPOSE`/`HEALTHCHECK` and this file's `healthCheckPath` assume, and nothing lines up.

**Railway** (if you'd rather avoid Render's cold starts, at ~$5/mo): New Project → Deploy from repo → root directory `.`, Dockerfile path `apps/backend/Dockerfile` → add the same env vars via the Variables tab.

Render free-tier tradeoff: the service spins down after 15 min idle, ~30–60s cold start on the next request. Stripe retries webhook delivery on timeout, so this delays events, doesn't lose them.

### Migrate, seed, and create an admin user

**Render's free tier has no Shell/one-off-job access — both require the paid Starter instance type** (confirmed against a real "Enable Shell Access" upgrade prompt; Railway's `railway run` is the equivalent free-tier-compatible option there). On Render's free tier, use `apps/backend/scripts/bootstrap-staging.sh` instead — a one-time startup override, not an interactive shell:

1. Set two env vars on the service (**Environment** tab): `STAGING_ADMIN_EMAIL` and `STAGING_ADMIN_PASSWORD` — your real admin login for `apps/admin`.
2. **Settings → Docker Command**, set it to:
   ```
   sh scripts/bootstrap-staging.sh
   ```
   (Render's Docker Command field does not reliably parse `&&`-chained shell strings typed directly into it — confirmed against a real failed deploy where the entire chained command was passed through as one unparsed token. A checked-in script file sidesteps that entirely: one simple token, no quoting.)
3. Save — this triggers a deploy that runs migrations → seed data → business-config defaults → creates your admin user → **then** starts the server, all in one boot. Watch **Logs**; expect this first boot to take longer than normal.
4. Once it reaches **"Live"**, go back to **Settings → Docker Command** and **clear it back to blank** — this reverts to the Dockerfile's normal `npm run start` for every deploy after this one. Re-running the seed scripts or `medusa user` a second time is not safe (duplicate data / duplicate-user error), so this override must not stay in place permanently.

Railway (no Docker Command field issue there, or use its Shell): same four commands, run via `railway run <command>`, in order — `npx medusa db:migrate`, `npx medusa exec ./src/migration-scripts/initial-data-seed.ts`, `npx medusa exec ./src/scripts/seed-business-config.ts`, `npx medusa user -e you@example.com -p <password>`.

Skip `seed-seller.ts` either way — it's an explicit dev/test-only convenience script for creating a demo seller login without going through the real application-approval flow (see its own header comment). Use the real seller-application flow once the seller-portal is deployed instead, unless you specifically want a demo seller to poke at early.

### Health check

```bash
curl -i https://<your-backend>.onrender.com/health
# expect: HTTP/1.1 200 OK
```

### Logs

- Render: dashboard **Logs** tab (live tail), or `render logs <service-name> --tail` via the [Render CLI](https://render.com/docs/cli).
- Railway: `railway logs` (CLI), scoped to the linked service, or the dashboard's **Deployments → Logs** view.

### Rollback

- Render: **Deploys** tab on the service → pick a previous successful deploy → **Redeploy**. Render keeps prior build images; no rebuild needed for a same-image rollback.
- Railway: **Deployments** tab → previous deployment → **Redeploy**.
- If a bad *migration* shipped (not just a bad app version): migrations in this project have no automated `down` runner wired to a CLI shortcut — write and run the specific migration's `down()` manually via `npx medusa db:migrate` tooling is forward-only by default, so the safe path is: redeploy the previous app image first (above), then restore the Supabase database from its automatic daily backup (Supabase dashboard → Database → Backups) if the migration already altered data, not just schema. Test this restore path once for real before you rely on it, per `docs/DEPLOYMENT.md` §6's standing gap ("no automated restore drill exists").

## §4. Frontends — Vercel (storefront, seller-portal, admin)

Vercel URLs are also deterministic (`https://<project-name>.vercel.app`), so name the projects before deploying if you want the backend's CORS vars set up front.

For each of the three apps: **New Project → import this repo → Root Directory** = `apps/storefront`, `apps/seller-portal`, or `apps/admin`. Vercel auto-detects Next.js and handles the workspace install itself — no Dockerfile involved, nothing else to configure.

Env vars per app — see §5 for the full reference:

| App | Required env vars |
|---|---|
| storefront | `MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| seller-portal | `MEDUSA_BACKEND_URL` |
| admin | `MEDUSA_BACKEND_URL` |

`MEDUSA_PUBLISHABLE_KEY` comes from the deployed backend's admin (Settings → Publishable API Keys), created **after** §3's seed step and the admin user exist.

### Health check

```bash
curl -i https://<your-app>.vercel.app/
# expect: HTTP/2 200 (storefront/admin homepage renders)
```

### Rollback

Vercel keeps every deployment. Dashboard → **Deployments** → pick a prior one → **Promote to Production**. No rebuild.

## §5. Close the loop, then the full environment-variable reference

Once all four services (backend + 3 frontends) have real URLs:
1. Go back to the backend's env vars (Render/Railway dashboard) and set `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `SELLER_PORTAL_URL`, `COURIER_PORTAL_URL` to the actual Vercel URLs.
2. **Register the Stripe webhook** (Stripe Dashboard, test mode → Developers → Webhooks → **Add endpoint**): `https://<your-backend>.onrender.com/webhooks/stripe`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Redeploy the backend (env var changes trigger this automatically on both platforms, or trigger manually).

### Env vars — backend, categorized

**Safe public configuration** (fine in a dashboard, not secret, not business-sensitive):
| Var | Value |
|---|---|
| `STORE_CORS` | `https://<storefront>.vercel.app` |
| `ADMIN_CORS` | `https://<admin>.vercel.app` |
| `AUTH_CORS` | `https://<storefront>.vercel.app,https://<seller-portal>.vercel.app,https://<admin>.vercel.app` |
| `SELLER_PORTAL_URL` | `https://<seller-portal>.vercel.app` |
| `COURIER_PORTAL_URL` | `https://<admin>.vercel.app/courier` |
| `ENABLE_TEST_SUPPORT_ROUTES` | `false` — must stay false outside CI |
| `EMAIL_PROVIDER` | leave blank (keeps `notification-local`; no email actually sends) |
| `S3_BUCKET` | blank unless you did §"Object storage" below |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` — required for Supabase, see §2 step 4. Not a real secret itself, but keep it next to `DATABASE_URL` for clarity |

**Private secrets** (Render/Railway's secret-marked env vars, never in git):
| Var | Source |
|---|---|
| `DATABASE_URL` | §2, includes the Supabase password |
| `JWT_SECRET` | generate: `openssl rand -hex 32` (or `render.yaml`'s `generateValue: true` does this for you) |
| `COOKIE_SECRET` | same |
| `AUTH_MFA_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard, **test mode**, `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | from §5 step 2 above, `whsec_...` |

**Production-only credentials — do NOT set any of these for staging:**
| Var | Why it stays unset here |
|---|---|
| `sk_live_...` (a live Stripe key) | Staging is test-mode only, per this task's own instructions and `CLAUDE.md`'s non-negotiable rule |
| Real `BREVO_API_KEY` | Required for free transactional email after `bawishopping.com` is verified in Brevo; store it only as a Render secret |
| AWS-specific S3 IAM-role auth (`authentication_method: "s3-iam-role"`, i.e. leaving `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` blank while `S3_BUCKET` is set) | Only applies on ECS with a task role — not this path. If using R2 here, set explicit `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` instead (R2 has no IAM-role concept) |

**Placeholder business settings** — not env vars at all; they live in the `business_config_entry` table, seeded by §3's `seed-business-config.ts` step with `is_placeholder: true` on each. See §7 — no action needed for staging, only before a real launch.

### Env vars — frontends

| Var | App(s) | Category |
|---|---|---|
| `MEDUSA_BACKEND_URL` | all 3 | Safe public config |
| `MEDUSA_PUBLISHABLE_KEY` | storefront | Safe public config (scoped API key, not a secret in Medusa's model, but still specific to this environment) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | storefront | Safe public config — Stripe **test-mode** publishable key, `pk_test_...` (never a secret key) |

### Object storage (product images) — optional

Render/Railway free containers have ephemeral disk. Two options, no code change either way:
- **Accept it for staging** — simplest; images may need re-uploading after a redeploy.
- **Cloudflare R2 free tier** (10GB, S3-compatible): set `S3_BUCKET`, `S3_ENDPOINT` (R2's endpoint), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION=auto`. Same `authentication_method: "access-key"` code path already wired in `medusa-config.ts` for any non-AWS S3-compatible provider.

## §6. Feature-flag and payment-mode confirmation

Nothing in this deployment path changes any of these — confirming explicitly since it's this task's own requirement:
- `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` above are **test mode** (`sk_test_...`/webhook registered under Stripe's test-mode toggle). Never enter a `sk_live_...` key for this environment.
- `live_payments_enabled`, `real_transfers_enabled`, `real_payouts_enabled`, `real_refunds_enabled`, `real_tax_calculation_enabled`, `real_email_enabled`, `real_sms_enabled`, `real_courier_booking_enabled` all default `false` from `seed-business-config.ts` (§3) and are never touched by anything in this document. Verify with §8's readiness check.
- `EMAIL_PROVIDER` staying blank keeps every notification on `notification-local`. For beta delivery set it to `brevo`, add `BREVO_API_KEY`, use `support@bawishopping.com`, and deliberately enable `real_email_enabled` after a reset-email test succeeds.

## §7. Remaining placeholder business decisions (unaffected by this deployment)

These are pre-existing, business/legal decisions — not deployment work, not blocking staging — carried over unchanged from `docs/DECISIONS.md`/`CLAUDE.md`: commission rate, shipping fee, free-shipping threshold, return window/policy, seller prep deadline, cancellation cutoff, service area, tax rate/provider, courier/email/SMS provider selection, support contact info, and every `legal.*` entry (company legal name, address, registered agent state, DMCA/privacy contact emails, terms-last-updated). Run §8's readiness check against this staging database for the current, authoritative list — it's DB state, not something this document can hardcode a number for.

## §8. Production-readiness check — run against staging

```bash
# From apps/backend, with DATABASE_URL pointed at the staging Supabase DB
# (either run this via Render/Railway's shell against the live service,
# or locally with DATABASE_URL temporarily overridden):
npx medusa exec ./src/scripts/check-production-readiness.ts
```
Prints every `business_config_entry` still at its placeholder default, plus the live value of every `real_*`/`live_payments_enabled` flag. Expect every flag `false` and a non-empty placeholder list (§7) — that's the correct, safe state for staging.

## §9. GitHub Actions — checking CI, especially the 3 previously-local-blocked spec files

`.github/workflows/ci.yml` runs on every push to `main` and every PR: a `lint-typecheck-unit-build` job, and a `backend-integration` job against a real `postgres:16` service container (unrelated to Supabase — CI provisions its own disposable database, never touches staging).

`checkout.spec.ts`, `fulfillment.spec.ts`, and `seller-finance.spec.ts` (all under `apps/backend/integration-tests/http/`) are part of that job's `npm run test:integration` step — this local machine's memory pressure previously prevented them completing locally; CI is where to actually confirm they pass.

**Web UI:** repo → **Actions** tab → latest run of `backend-integration` → expand the "Run integration tests" step, search its output for the three filenames.

**CLI (`gh`):**
```bash
gh run list --repo Bawishoppingapp/bawi-shopping --workflow=ci.yml --limit 5
gh run view <run-id> --repo Bawishoppingapp/bawi-shopping --log \
  | grep -E "checkout\.spec\.ts|fulfillment\.spec\.ts|seller-finance\.spec\.ts|PASS|FAIL"
```
A clean run shows `PASS integration-tests/http/checkout.spec.ts` (and the other two) with no `FAIL` lines in that job.

## §10. Load/soak testing against staging

Once §3–§5 are deployed and the smoke test (below) passes:
```bash
# Quick sanity check against the real staging URLs (seconds):
k6 run -e BASE_URL=https://<storefront>.vercel.app \
       -e BACKEND_URL=https://<your-backend>.onrender.com \
       load-testing/smoke.js

# Ramping load (~3.5 min):
k6 run -e BASE_URL=https://<storefront>.vercel.app \
       -e BACKEND_URL=https://<your-backend>.onrender.com \
       load-testing/load.js

# Soak test - override duration, then actually let it run:
k6 run -e BASE_URL=https://<storefront>.vercel.app \
       -e BACKEND_URL=https://<your-backend>.onrender.com \
       -e SOAK_DURATION=1h \
       load-testing/soak.js
```
Expect Render's free-tier cold start to show up as one slow first request if the service had been idle — not a failure, just the tradeoff noted in §3. See `load-testing/README.md` for how to read `http_req_duration`/`http_req_failed` thresholds.

## §11. End-to-end smoke test (after §3–§5)

Register a customer on the storefront → submit a seller application (seller-portal) → approve it (admin) → activate the seller → create and approve a product → add to cart → complete a **test-mode** Stripe checkout (use [Stripe's test card `4242 4242 4242 4242`](https://stripe.com/docs/testing)) → confirm the webhook fires and splits the order → confirm an in-app notification appears. This exercises every module across all 16 slices in one pass.

## Known limitations of this interim setup

- **Vercel's Hobby (free) plan** is intended for personal/non-commercial use per Vercel's own terms — fine for private validation with no real customers; revisit before onboarding real vendors/customers.
- **Render free-tier cold starts** (~30–60s) — Stripe retries on timeout, so this delays webhook delivery, doesn't lose events.
- **Supabase free-tier auto-pause** after ~1 week idle.
- **Single backend instance, no Redis** — matches this project's existing "Redis optional" design, not a new gap.

## Migrating back to AWS later

1. `terraform apply` in `infra/terraform/` (audited, hardened — see `infra/terraform/DEPLOYMENT-SEQUENCE.md`) to provision RDS, ECS, ALB, etc.
2. `pg_dump` from Supabase's direct connection, restore into the new RDS instance.
3. Push the same Docker images (unchanged) to ECR; let ECS run them instead of Render/Railway.
4. Repoint DNS from the Vercel/Render URLs to the ALB/CloudFront Terraform provisions.

No application code changes required — every external dependency is env-var-driven by design.
