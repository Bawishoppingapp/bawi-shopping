# Bawi Shopping — Deployment and Launch Guide

This is the operational counterpart to `docs/IMPLEMENTATION-PLAN.md`. That document tracks what's been *built*; this one tracks what a human operator does to actually *run it* — every environment variable, every third-party service, every production setting, every feature flag, the deployment sequence, backups, monitoring, and the exact process for moving from mock/test values to real ones.

Nothing in this document is aspirational — every setting, route, and script named below exists in this repository today and was verified against the actual source during this session. Where something genuinely isn't built yet (a worker process, a monitoring stack), that's stated plainly rather than glossed over — see §9.

Security hardening (rate limiting, CSP/security headers, dependency-audit findings) is documented in `docs/SECURITY.md` §16, not duplicated here — this document covers infrastructure, integrations, and the deployment sequence; that one covers the threat model and what's been hardened against it.

**This document describes the AWS/Terraform path.** Before onboarding real vendors/customers, an interim free/low-cost path (Vercel + Render/Railway + Supabase Postgres) is also available and requires almost no changes from what's described here — see `docs/DEPLOYMENT-LOWCOST.md`.

## 1. What gets deployed

Four deployables today (a fifth, `apps/workers`, is designed for but not built — see §9):

| Deployable | What it is | Default port |
|---|---|---|
| `apps/backend` | Medusa 2.x API server — the system of record. Everything else is a thin client over it. | `9000` |
| `apps/storefront` | Customer-facing Next.js app | `3000` |
| `apps/seller-portal` | Seller-facing Next.js app | `3001` |
| `apps/admin` | Bawi staff admin app, including the courier portal at `/courier/*` | `3002` |

Each frontend is a standard Next.js app (`npm run build && npm run start`, or deploy to any Next.js-compatible host) built with `output: "standalone"` for a lean container image. The backend is a standard Node/Medusa process — deploy it anywhere that runs a long-lived Node process with outbound network access to Postgres and Stripe.

**Dockerfiles exist for all four deployables** (`apps/backend/Dockerfile`, `apps/storefront/Dockerfile`, `apps/seller-portal/Dockerfile`, `apps/admin/Dockerfile`) plus a root `docker-compose.yml` for local production-mode verification. Every Dockerfile must be built with the **repository root as build context** (not the app's own directory), since this is an npm-workspaces monorepo and every app depends on at least one `packages/*` workspace package:

```bash
docker build -f apps/backend/Dockerfile -t bawi-backend .
docker build -f apps/storefront/Dockerfile -t bawi-storefront .
```

Or, to build and run the whole stack locally against a real Postgres (and, optionally, Redis) the same way a real environment would:

```bash
docker compose up --build
```

See `docker-compose.yml`'s own header comment for the one-time setup this needs (backend secrets) — it's a local verification tool, not a hosting recommendation; a real environment still needs a managed Postgres, real secrets in a proper secret store, and a registered Stripe webhook endpoint (§2.4, §5).

**`infra/terraform/` provisions a real AWS environment** — networking, all four apps on ECS Fargate behind one ALB, RDS Postgres, ElastiCache Redis, an S3 bucket, Route53 + ACM (DNS/TLS), and CloudWatch alarms/SNS alerting — from one `terraform apply`. It's a template with placeholder values (see `infra/terraform/terraform.tfvars.example`), validated this session with a real `terraform init`/`validate`/`plan` (the plan run stops cleanly at "no AWS credentials found," exactly as expected with no cloud account attached to this session) but never applied against a real account. See `infra/terraform/README.md` for exactly what it does and does not automate, and `infra/terraform/DEPLOYMENT-SEQUENCE.md` for the full phase-by-phase walkthrough (AWS prerequisites → image build/publish → apply → DNS → migration → admin account → Stripe → verification), each phase marking what's already done vs. what needs you.

## 2. Every environment variable, by app

### 2.1 `apps/backend`

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | Yes (contains credentials) | Postgres connection string. One dedicated database per environment (local/staging/production) — never shared. |
| `STORE_CORS` | Yes | No | Comma-separated allowed origins for the Store API (storefront's origin). |
| `ADMIN_CORS` | Yes | No | Comma-separated allowed origins for the Admin API (admin app's origin, plus Medusa's own admin dashboard origin if used). |
| `AUTH_CORS` | Yes | No | Comma-separated allowed origins for `/auth/*` routes — must include storefront, seller-portal, and admin origins. |
| `JWT_SECRET` | Yes | **Yes** | Signs session JWTs for every actor type (`customer`, `seller_user`, `user`, `courier`). Generate a long random string per environment; never reuse the placeholder in `.env.example`, never reuse across environments. |
| `COOKIE_SECRET` | Yes | **Yes** | Signs session cookies. Same rule as `JWT_SECRET` — unique per environment. |
| `AUTH_MFA_ENCRYPTION_KEY` | Yes | **Yes** | A 64-character hex string used by Medusa's auth module. Generate with `openssl rand -hex 32`. |
| `SELLER_PORTAL_URL` | Yes | No | Base URL the backend uses to build the seller account-activation link (`docs/MARKETPLACE-FLOWS.md`). Must be the real seller-portal origin in each environment. |
| `COURIER_PORTAL_URL` | Yes | No | Base URL for the courier portal, which lives inside `apps/admin` at `/courier` (not a separate app — see `docs/DECISIONS.md`). In production this is `<admin-app-origin>/courier`. |
| `ENABLE_TEST_SUPPORT_ROUTES` | Yes | No | **Must be `false` (or unset) in staging and production.** `true` exposes `/seller-test-support/*` routes and switches Stripe to a network-free fake client — for local dev and CI only. Treat a `true` value reaching production as a security incident, not a config typo. |
| `STRIPE_SECRET_KEY` | Yes (once live) | **Yes** | Stripe **platform account** secret key. Test-mode (`sk_test_...`) until the go-live decision in §8; live (`sk_live_...`) only after that decision, and only ever set directly in the hosting provider's secret store — never committed, never in a shared `.env` file. |
| `STRIPE_WEBHOOK_SECRET` | Yes (once live) | **Yes** | Signing secret for the `/webhooks/stripe` endpoint (see §2.4). One value per registered webhook endpoint — staging and production have different endpoints and therefore different secrets. |
| `REDIS_URL` | Recommended for production | Yes (may contain credentials) | **Wired and conditional**: unset (the default), the backend uses Medusa's in-memory event bus/cache/locking/workflow-engine, correct for a single instance. Set it, and `medusa-config.ts` automatically switches all four to their Redis-backed equivalents — **required** the moment you run more than one backend instance (see §9). No other config change needed; the packages are already installed. |
| `EMAIL_PROVIDER` | No | No | Leave unset for local logging. Set to `resend` for the zero-cost beta path, or use the existing `brevo`/`sendgrid` adapters. |
| `RESEND_API_KEY` | Only if `EMAIL_PROVIDER=resend` | **Yes** | Resend transactional-email API key; deployment secret only. |
| `RESEND_FROM_EMAIL` | Only if `EMAIL_PROVIDER=resend` | No | Sender on a verified Resend domain, currently `support@bawishopping.com`. |
| `RESEND_FROM_NAME` | No | No | Sender display name; defaults to `Bawi Shopping`. |
| `BREVO_API_KEY` | Only if `EMAIL_PROVIDER=brevo` | **Yes** | Brevo transactional-email API key; deployment secret only. |
| `BREVO_FROM_EMAIL` | Only if `EMAIL_PROVIDER=brevo` | No | Verified sender, currently `support@bawishopping.com`. |
| `BREVO_FROM_NAME` | No | No | Sender display name; defaults to `Bawi Shopping`. |
| `SENDGRID_API_KEY` | Only if `EMAIL_PROVIDER=sendgrid` | **Yes** | SendGrid API key. |
| `SENDGRID_FROM_EMAIL` | Only if `EMAIL_PROVIDER=sendgrid` | No | The "from" address for outgoing transactional email. |
| `S3_BUCKET` | No | No | Leave unset to keep using local-disk file storage. Set it (plus `S3_REGION`) to switch product-image storage to S3 — see §8. **On AWS** (e.g. via `infra/terraform`), that's the only S3 variable you need — leave `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` both unset and the backend's ECS task IAM role supplies credentials automatically (`infra/terraform/iam.tf`). |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Only for a non-AWS S3-compatible provider | **Yes** | Only set these together for a provider with no IAM-role concept (MinIO, DigitalOcean Spaces via `S3_ENDPOINT`). Setting them on AWS works too but reintroduces a static credential the IAM-role path exists specifically to avoid. |

### 2.2 `apps/storefront`

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `MEDUSA_BACKEND_URL` | Yes | No | The backend's public URL. |
| `MEDUSA_PUBLISHABLE_KEY` | Yes | No (publishable by design) | Created in the Medusa admin (Settings → Publishable API Keys) and scoped to the storefront's sales channel. Regenerate per environment — don't reuse a staging key in production. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes (once checkout takes real cards) | No (publishable by design) | Test-mode (`pk_test_...`) or live (`pk_live_...`) Stripe publishable key, mounted client-side for the Payment Element. Never put a secret key in a `NEXT_PUBLIC_*` variable. |

### 2.3 `apps/seller-portal` and `apps/admin`

Both need only:

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `MEDUSA_BACKEND_URL` | Yes | No | The backend's public URL. |

Neither app talks to Stripe directly — Stripe Connect onboarding and payment handling are entirely backend-mediated.

### 2.4 Values that aren't environment variables but must exist before launch

- **Stripe webhook endpoint**, registered in the Stripe Dashboard against the backend's `POST /webhooks/stripe`, subscribed at minimum to `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated` (Connect), `charge.dispute.created`, and `charge.dispute.closed` — see `docs/PAYMENTS.md` for the full event list this handler processes. Staging and production each need their **own** endpoint (and therefore their own `STRIPE_WEBHOOK_SECRET`).
- **A Medusa admin user**, created via `npx medusa user -e you@example.com -p <password>` against the target environment's database — this is how the first admin logs into `apps/admin` and everything else (invites, seller staff, translations) branches from there.
- **A publishable API key + sales channel** in the Medusa admin, consumed by the storefront's `MEDUSA_PUBLISHABLE_KEY`.

## 3. Third-party services

| Service | Status | Notes |
|---|---|---|
| **PostgreSQL** | Required, wired | One instance, three databases (`bawi_shopping_dev`/`_test` locally; one per real environment). Any managed Postgres 14+ works — local dev uses Postgres.app on port `5544` (`docs/DECISIONS.md`), which has no bearing on hosted environments. |
| **Stripe** (platform account + Connect Express) | Required, wired | One Stripe account, test mode until §8's go-live decision. See `docs/PAYMENTS.md` for the full commission/transfer/refund model. |
| **Redis** | Wired, conditional on `REDIS_URL` | Optional for a single-instance deployment (Medusa's in-memory event bus/cache/locking/workflow-engine is used by default, confirmed by the literal startup log lines: `Local Event Bus installed. This is not recommended for production.` / `Locking module: Using "in-memory" as default.`). Set `REDIS_URL` and `medusa-config.ts` switches all four to their Redis-backed equivalents automatically — **required** before running more than one backend instance. Verified this session: booting with `REDIS_URL` unset behaves identically to before; booting with it set to an unreachable address fails loudly rather than silently, which is the correct behavior. |
| **Object storage (S3-compatible)** | Wired, conditional on `S3_BUCKET` | Product images go through Medusa's native `file` module. Local disk is the default (fine for one instance with persistent disk, unsuitable for anything horizontally scaled or ephemeral); set `S3_BUCKET` and `medusa-config.ts` switches to `@medusajs/file-s3` automatically. **On AWS, no credential variables are needed at all** — the ECS task's IAM role (`infra/terraform/iam.tf`) supplies them via the AWS SDK's default credential chain (confirmed against `@medusajs/file-s3`'s own source, which supports `authentication_method: "s3-iam-role"` for exactly this). Only set `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` for a non-AWS S3-compatible provider (MinIO, DigitalOcean Spaces) via `S3_ENDPOINT`. |
| **Transactional email provider** | Wired for Resend, Brevo, or SendGrid | `notification-local` is the default. For the free beta path, verify `bawishopping.com` in Resend, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL=support@bawishopping.com`, then enable real email in business configuration. |
| **SMS provider** | Not selected | `business-config`'s `sms.provider` is a placeholder (`mock_disabled`); `real_sms_enabled` stays `false` until one is chosen and wired. |
| **Tax provider** | Not selected | `tax.provider` is a placeholder (`mock`) using a flat 8.25% rate; `real_tax_calculation_enabled` stays `false` until a real jurisdiction-aware provider replaces the mock adapter in `src/tax/`. |
| **Courier/delivery provider** | Not selected | `courier.provider` is a placeholder (`mock_bawi_courier`); today couriers are admin-provisioned accounts using the app's own pickup/tracking-code flow, not an external logistics API. `real_courier_booking_enabled` stays `false`. |
| **CDN** | Not required, recommended | For serving product images once object storage is wired (§9) — not needed for the current local-disk setup. |
| **Error tracking / APM / uptime monitoring** | Not wired | See §9's monitoring section — nothing beyond structured stdout logging exists in the codebase today. |

## 4. Production settings and feature flags

All business-configuration values live in one place: the `business-config` module (`apps/backend/src/modules/business-config/`), stored as `{category, key, value, is_placeholder}` rows, audit-logged on every change. **Never hardcode a business value in code** — add or edit a `business-config` entry instead.

### 4.1 How to view and change a value

- **Admin UI**: `apps/admin` → `/config` (`apps/admin/src/features/business-config/`) — lists every entry with its current value and `is_placeholder` status, and lets an authenticated admin user edit one.
- **API directly**: `GET /admin/business-config` (list all) and `PUT /admin/business-config/:category/:key` (update one), both requiring an admin `user` session.
- **Read-only report**: `npx medusa exec ./src/scripts/check-production-readiness.ts` (see §8) — prints every entry still at its placeholder default plus the state of every feature flag. This is a report, not a gate; nothing in CI or the deploy path currently blocks a deploy on its output (see §8's closing note on making that automatic).

### 4.2 Every business-config entry, its default, and whether it's a placeholder

| Category | Key | Default | Placeholder? | What flipping it means |
|---|---|---|---|---|
| `commission` | `platform_default_rate_basis_points` | `1500` (15.00%) | **Yes** | The commission rate applied to every sale absent a seller- or category-level override. A pricing/business decision. |
| `transfer_timing` | `transfer_hold_days` | `7` | **Yes** | Days after confirmed delivery before a seller's earnings become payable. |
| `returns` | `return_window_days` | `14` | **Yes** | Days after delivery a customer may request a return. |
| `returns` | `return_shipping_policy` | `customer_pays_unless_defective` | **Yes** | Who pays return shipping. |
| `shipping` | `standard_shipping_fee_cents` | `699` | **Yes** | Flat shipping fee. **The one remaining placeholder as of this session** — see §8. |
| `shipping` | `free_shipping_threshold_cents` | `7500` | **Yes** | Order subtotal above which shipping is free. |
| `preparation` | `seller_preparation_deadline_hours` | `48` | **Yes** | Hours a seller has to mark an order ready for pickup. |
| `cancellation` | `cancellation_cutoff` | `preparing` | **Yes** | Latest fulfillment stage at which a customer may still cancel. |
| `service_area` | `initial_service_area` | `Dallas-Fort Worth, Texas` | **Yes** | Launch geography. |
| `brand_visibility` | `vendor_brand_requires_approval` | `true` | No — v1 scope decision | Whether a seller's storefront brand name needs Bawi approval before going public. |
| `payment_methods` | `currency` | `USD` | No | Settlement currency. |
| `payment_methods` | `accepted_methods` | `["stripe_test_cards","stripe_test_wallets"]` | No | Cosmetic/informational; real Stripe payment-method types are configured in the Stripe Dashboard, not here. |
| `tax` | `provider` | `mock` | **Yes** | See §3. |
| `tax` | `mock_rate_basis_points` | `825` (8.25%) | **Yes** | Flat placeholder tax rate applied uniformly regardless of address, until a real provider replaces the adapter. |
| `courier` | `provider` | `mock_bawi_courier` | **Yes** | See §3. |
| `email` | `provider` | `mock_local` | **Yes** | See §3. |
| `sms` | `provider` | `mock_disabled` | **Yes** | See §3. |
| `support` | `support_email` | `support@example.bawishopping.com` | **Yes** | Real support inbox needed before launch. |
| `support` | `support_phone` | `+1-555-0100-TEST` | **Yes** | A clearly fake placeholder — real support line needed before launch. |
| `cart` | `cart_expiration_days` | `30` | No — v1 scope decision | Days of inactivity before a cart is treated as abandoned. |
| `cart` | `max_quantity_per_line_item` | `10` | No — v1 scope decision | Per-line-item quantity cap. |
| `legal` | `company_legal_name` | placeholder entity name | **Yes** | Referenced throughout `docs/legal/*.md` as `[legal.company_legal_name]` — see §4.4. |
| `legal` | `company_address` | placeholder address | **Yes** | Same. |
| `legal` | `registered_agent_state` | `Texas` (placeholder) | **Yes** | Same. |
| `legal` | `dmca_agent_email` | placeholder email | **Yes** | Also requires a real DMCA agent registration with the U.S. Copyright Office — see `docs/legal/DMCA-POLICY.md`. |
| `legal` | `privacy_contact_email` | placeholder email | **Yes** | Same. |
| `legal` | `terms_last_updated` | placeholder date | **Yes** | Must be updated whenever the legal documents materially change. |

### 4.3 Legal and policy documents

`docs/legal/` contains seven draft policy documents (Terms of Service, Privacy Policy, Seller Agreement, Returns & Refunds Policy, Cookie Policy, Acceptable Use Policy, DMCA Policy) — see `docs/legal/README.md` for the full index. Every one is explicitly marked as a draft requiring attorney review, and every business/legal detail in them is a `[category.key]` reference into the `legal` business-config category above (§4.2), the same placeholder mechanism used everywhere else in this project.

The storefront renders live (but clearly bannered "pending attorney review") pages at `/legal/terms`, `/legal/privacy`, `/legal/returns`, `/legal/cookies`, `/legal/acceptable-use`, and `/legal/dmca`, linked from its footer — see `apps/storefront/src/features/legal/`. **Before a real launch:** have an attorney review and revise every document in `docs/legal/`, replace every `legal` category placeholder via the admin `/config` UI, and only then remove the draft banner (`apps/storefront/src/features/legal/components/legal-document-page.tsx`).

### 4.4 Every feature flag

All nine default `false` and gate a code path that would otherwise move real money, send a real communication, or book a real courier — flipping any of them is a launch decision, not a config tweak done casually:

| Flag | Gates |
|---|---|
| `live_payments_enabled` | Whether checkout is allowed to run against Stripe **live** mode at all — the master switch. |
| `real_transfers_enabled` | Whether commission-ledger transfers to sellers use real Stripe Connect transfers vs. staying test-mode. |
| `real_payouts_enabled` | Whether admin-triggered payout batches move real money. |
| `real_refunds_enabled` | Whether approved returns/cancellations issue real Stripe refunds. |
| `real_tax_calculation_enabled` | Whether checkout uses a real tax provider instead of the flat mock rate. |
| `real_email_enabled` | Whether notifications actually send email instead of only logging via `notification-local`. |
| `real_sms_enabled` | Whether SMS sends for real (no SMS provider is wired yet — see §3). |
| `real_courier_booking_enabled` | Whether fulfillment books a real external courier instead of using the app's own admin-assigned courier flow. |
| `promotional_codes_enabled` | Whether promotional/discount codes are accepted at checkout (deferred feature — see `docs/PRD.md` §"Deferred Features"). |

## 5. Deployment steps

These steps apply to standing up any environment (staging or production) from scratch. Repeat per environment — never share a database, Stripe account, or set of secrets across environments.

**If using `infra/terraform`** (§1), step 1 (Postgres), most of step 3 (CORS/secrets get wired into the ECS task definition directly), and the Redis/S3 pieces of step 3 all happen as part of `terraform apply` — fill in `terraform.tfvars` first (real domain, real generated secrets, real pushed image URIs), then `terraform init && terraform plan && terraform apply`, and resume at step 5 below (creating the admin user) once it completes. Steps 5-7 and 10-11 are never automated by Terraform regardless — they're one-time, stateful actions against the running application, not infrastructure.

1. **Provision Postgres.** Create a dedicated database. Note its connection string for `DATABASE_URL`.
2. **Generate secrets.** `JWT_SECRET`, `COOKIE_SECRET` (long random strings), `AUTH_MFA_ENCRYPTION_KEY` (`openssl rand -hex 32`) — unique to this environment, stored in the hosting provider's secret manager, never in a committed file.
3. **Set backend environment variables** (§2.1) — CORS origins pointing at this environment's actual frontend URLs, `ENABLE_TEST_SUPPORT_ROUTES` unset or `false`, Stripe keys in **test mode** initially even in a "production" environment (see §8 — going live with Stripe is a separate, deliberate step after the environment itself is verified working).
4. **Deploy the backend** and run `npx medusa db:migrate` against it — this applies every module's migrations in one pass and is also this project's own smoke test for workflow-definition errors (see `docs/DECISIONS.md`). Confirm it exits cleanly before proceeding.
5. **Create the first admin user**: `npx medusa user -e you@example.com -p <a-real-password>` against this environment.
6. **Log into `apps/admin`**, go to Settings → Publishable API Keys, create one scoped to the storefront's sales channel — this becomes the storefront's `MEDUSA_PUBLISHABLE_KEY`.
7. **Register the Stripe webhook endpoint** for this environment against `<backend-url>/webhooks/stripe` (see §2.4 for the event list); copy the resulting signing secret into `STRIPE_WEBHOOK_SECRET`.
8. **Deploy the three frontends** (`apps/storefront`, `apps/seller-portal`, `apps/admin`), each with its own `MEDUSA_BACKEND_URL` pointing at step 4's backend, and the storefront additionally with `MEDUSA_PUBLISHABLE_KEY` (step 6) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
9. **Update the backend's `SELLER_PORTAL_URL` and `COURIER_PORTAL_URL`** to this environment's real seller-portal and admin origins (courier portal lives at `<admin-url>/courier`), and redeploy the backend if these weren't already set correctly in step 3.
10. **Smoke test end to end**: register a customer, submit and approve a seller application, activate the seller, create and approve a product, add to cart, complete a test-mode checkout, confirm the Stripe webhook fires and splits the order, confirm a notification appears in-app, and confirm the storefront's `/legal/*` pages render (§4.4). This exercises every module built across all eleven vertical slices in one pass.
11. **Run the production-readiness check** (§8) and review its output before considering this environment "launch-ready" for real money.

## 6. Backup strategy

- **Database**: Postgres is the sole system of record — no other durable store exists. Use your hosting provider's automated daily snapshots plus point-in-time recovery (WAL archiving) if available; this project doesn't ship its own backup tooling or schedule, since that's an infrastructure-provider responsibility, not application code.
- **Migrations, not manual DDL**: every schema change is a checked-in migration (`docs/DATABASE.md` §6) — restoring a backup and replaying migrations forward is always possible; there is no hand-edited schema drift to reconcile.
- **Object storage** (once wired per §9): back up the bucket itself via the provider's versioning/replication — product images aren't reproducible from the database alone.
- **Audit log**: the `audit-log` module records every approval/rejection/financial/role-change action and is itself just Postgres rows — covered by the database backup above, with no separate retention policy defined yet. If a compliance-driven retention/export requirement emerges, that's a business decision to make explicit in `business-config`, not an assumption to bake in silently.
- **Stripe** is its own system of record for payment/transfer/dispute history — Stripe's dashboard and API are the source of truth there, not a local mirror; this project's ledger tables are a derived view (see `docs/PAYMENTS.md`), not the canonical record.
- **No automated restore drill exists** — this is a real gap, not a built feature. Test a restore in staging before trusting it in production; that's a one-time operational exercise this document can name but not perform for you.
- **If using `infra/terraform`**: `db_backup_retention_days` (`variables.tf`) provisions real RDS automated backups + point-in-time recovery, and the S3 bucket has versioning enabled — both real, not just documented as a recommendation. A restore drill is still a real operational exercise no Terraform apply performs for you.

## 7. Monitoring setup

Nothing beyond structured stdout logging (Medusa's built-in logger, used throughout every module and workflow in this codebase) exists today in the *application*. **`infra/terraform`'s `monitoring.tf`** closes part of this gap with real CloudWatch alarms (ECS CPU/memory per service, ALB 5xx rate, RDS CPU/storage/connections, Redis memory) publishing to an SNS topic with an email subscription — provisioned, not just recommended, once applied against a real AWS account. Beyond that, at minimum before a real launch:

- **Uptime / health checks** — Medusa exposes a `/health` endpoint (confirmed in this project's own source, `@medusajs/medusa`'s `start` command); all four Dockerfiles now have a `HEALTHCHECK` instruction hitting it (backend) or each frontend's homepage, and the ALB target groups in `infra/terraform/ecs.tf` health-check the same paths — real, wired monitoring at the container/load-balancer level, not just a recommendation.
- **Error tracking** (e.g., an APM/error-tracking SDK) in the backend and all three Next.js apps — none is installed currently; this is a genuine gap worth closing before production traffic, not something silently assumed to exist. `infra/terraform` doesn't install one either — that's an application-level dependency choice, not infrastructure.
- **Database monitoring** — CloudWatch RDS alarms above cover the essentials (CPU, storage, connections); deeper query-level monitoring (e.g., pg_stat_statements) is still your Postgres host's own tooling.
- **Stripe Dashboard** — webhook delivery success/failure, dispute rate, payout status — Stripe's own dashboard already covers this; no custom mirroring is needed unless you want it surfaced inside `apps/admin` too (not built, would be a new feature, not a gap in the current scope).
- **Log aggregation** — every ECS task ships its stdout to a CloudWatch log group already (`infra/terraform/ecs.tf`, 30-day retention); export those to a longer-term log platform if you need retention beyond that.
- **Load and soak testing** — `load-testing/` has real k6 scripts (smoke, ramping load, soak) and a genuine local dry-run result (`load-testing/RESULTS.md`) — including one anomalous multi-hour stall this session hit and diagnosed as sandbox-environment contention, not an application bug, on a clean immediate re-run. Real load/soak testing against real deployed infrastructure is still a required, separate step before trusting any capacity number — see `docs/LAUNCH-CHECKLIST.md` §11.

## 8. Switching from mock/test values to real production values

Do this **only after** §5's environment is fully deployed and smoke-tested, and only with explicit authorization — this is a business/financial decision, not a code change, per this project's own non-negotiable rule that `live_payments_enabled` and every `real_*` flag stay `false` until an explicit, separate production-launch approval (`CLAUDE.md`, `docs/DECISIONS.md`).

1. **Run the readiness report first**: `npx medusa exec ./src/scripts/check-production-readiness.ts`. As of this session it reports exactly one remaining placeholder (`shipping.standard_shipping_fee_cents`) and every feature flag `false`. Do not proceed past this step while it reports any placeholder you haven't consciously reviewed and either replaced or explicitly accepted as a genuine v1 scope decision (see §4.2's "No — v1 scope decision" rows for the two that are fine to leave as-is).
2. **Replace every remaining `is_placeholder: true` business-config value** with a real, approved business decision via the admin `/config` UI or `PUT /admin/business-config/:category/:key` (§4.1) — commission rate, shipping fee, return window, support contact info, service area, and so on. Each edit is audit-logged automatically.
3. **Select and wire real provider integrations** for anything whose flag you intend to flip, one at a time, in this order (each is independent — you don't have to do all of them together):
   - **Email**: set `EMAIL_PROVIDER=sendgrid` plus real `SENDGRID_API_KEY`/`SENDGRID_FROM_EMAIL` (§2.1 — already wired, config-only), set `email.provider` in business-config, then flip `real_email_enabled`. Any other provider (SMTP, a different API-based sender) would need its own Medusa notification-provider package added the same way `@medusajs/notification-sendgrid` already is.
   - **Object storage** (needed before real product-image traffic at scale, independent of the flags above): set `S3_BUCKET` (§2.1 — already wired, config-only). On AWS, that's the whole change — the ECS task's IAM role handles credentials; only set `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` for a non-AWS S3-compatible provider.
   - **Tax**: select and integrate a real jurisdiction-aware tax provider behind `src/tax/`'s existing adapter interface (this one genuinely needs new code — no provider is chosen or wired yet), set `tax.provider`, then flip `real_tax_calculation_enabled`.
   - **SMS**: select a provider, wire it (no adapter exists yet — there's no current code path that sends SMS at all), set `sms.provider`, then flip `real_sms_enabled`.
   - **Courier booking**: select a real logistics API if/when the in-app pickup/tracking-code model (already built and working) is no longer sufficient, set `courier.provider`, then flip `real_courier_booking_enabled`.
   - **Legal documents**: have an attorney review every document in `docs/legal/`, replace every `legal` business-config placeholder (§4.2, §4.4) with the reviewed value, and remove the draft banner from the storefront's `/legal/*` pages before linking them anywhere a real customer or seller would rely on them.
4. **Swap Stripe test keys for live keys** — set `STRIPE_SECRET_KEY` to a real `sk_live_...` value and register a **new**, separate live-mode webhook endpoint in the Stripe Dashboard (live and test mode webhooks are entirely separate registrations), updating `STRIPE_WEBHOOK_SECRET` accordingly. Do this directly in the hosting provider's secret store, never in a shared file.
5. **Flip `real_transfers_enabled`, `real_payouts_enabled`, and `real_refunds_enabled`** once you've confirmed a real Connect transfer/payout/refund behaves as expected against a real (but small, controlled) test transaction.
6. **Flip `live_payments_enabled` last** — this is the master switch that allows checkout to run against Stripe live mode at all. Treat this as the actual go-live moment.
7. **Re-run the readiness check** after every flag flip to confirm the change was applied where you intended and nothing else drifted.
8. **This process is entirely manual today** — nothing in CI or the deploy pipeline currently blocks a deploy on the readiness script's output (`docs/IMPLEMENTATION-PLAN.md`'s Phase 12 row notes this explicitly). Wiring the readiness check into CI as a hard gate before any environment's `live_payments_enabled` can be set is a reasonable follow-up, but is itself a process/policy change worth its own explicit decision rather than something to add silently.

**Steps 4-6 above are deliberately never automated by this project's own tooling.** `infra/terraform` has no variable that accepts a live Stripe key, and no code path in this repository sets `live_payments_enabled` or any other `real_*` flag to `true` — that switch is a real-money-enabling action performed by a human, directly, with real credentials, as a distinct and deliberate act separate from any infrastructure or deployment automation.

## 9. Known gaps, stated plainly

These are genuine, current gaps — not oversights hidden from this document, and not things to "fix" unilaterally without confirming scope first:

- **No background worker process.** `apps/workers` is designed (`docs/ARCHITECTURE.md` §7) but not built. Payout batches, and every other action that might eventually be a scheduled job, are admin-triggered actions today. This is fine at v1 scale; revisit if/when payout volume or reconciliation needs true scheduling.
- **Single-instance assumption — now closable via config, not yet exercised against a real multi-instance deployment.** `REDIS_URL` (§2.1) switches the event bus, cache, locking, and workflow engine to their Redis-backed equivalents in one step; this was verified this session to behave identically to the in-memory default when unset, and to fail loudly (not silently) when set to an unreachable address. What's **not** verified is the Redis-backed path under genuine multi-instance concurrent load — that requires an actual multi-instance deployment to test, which this sandbox can't provide.
- **Local-disk file storage is still the default** (fine for one instance with a persistent volume) but the S3 swap (§2.1, §8) is now wired and config-only, not a code change.
- **Rate limiting is in-memory, single-instance only** (`apps/backend/src/rate-limiting/rate-limiter.ts`, added this session — see `docs/SECURITY.md` §16). Correct for today's deployment; needs a Redis-backed store before it means anything across more than one instance.
- **`npm audit` reviewed but not blindly fixed** (see `docs/SECURITY.md` §9) — `sharp`, `lodash`, and `react-router` are flagged as worth a real dependency bump in a future, deliberate `@medusajs/*` version-upgrade pass; not done this session since it would desync the pinned `2.17.2` lockstep version across every `@medusajs/*` package.
- **No automated restore drill, no wired error-tracking/APM stack** (§6, §7) — real gaps for a human operator to close; CloudWatch alarms (`infra/terraform/monitoring.tf`) cover infrastructure-level signals but not application-level error tracking.
- **The production-readiness check is a report, not a gate** — nothing currently stops a deploy or a flag flip if it reports a placeholder. See §8's closing note.
- **Legal documents are drafts pending attorney review** (§4.4) — the storefront pages exist and are live, but must not be treated as final, binding terms until reviewed.
- **`infra/terraform` has never been applied against a real AWS account** — this session has no cloud credentials. It's validated (`terraform init`/`validate`/`plan` all ran cleanly, per §1) but not proven against a real account; `terraform plan` should still be reviewed carefully by whoever runs the first real `apply`. A second audit pass fixed a real bug (two ALB target group names exceeded AWS's 32-character limit — `terraform validate` can't catch AWS-side constraints like this) and moved secrets from plaintext ECS task-definition environment variables to AWS Secrets Manager, and S3 access from a static IAM user/access key to an ECS task IAM role — see `infra/terraform/README.md`'s "Audit pass" section for the full list.
- **The k6 load test hit one severe, anomalous multi-hour stall during this session's local dry run**, diagnosed as sandbox-environment resource contention (not an application bug, confirmed by an immediate clean re-run) — see `load-testing/RESULTS.md`. Real load/soak testing against real deployed infrastructure remains a required, separate step; don't treat either local dry-run result as a real capacity number.
# Email routing safety

The local notification provider owns `email-local`, while the configured real provider owns `email`. Notifications use the real channel only when `real_email_enabled` is true and `EMAIL_PROVIDER` selects Resend, Brevo, or SendGrid. This prevents duplicate channel registration from silently routing production email to the local logger. Password-reset tokens are never explicitly logged in production.

Mobile clients can read the current public Store API key from `GET /mobile-config` after a key rotation. The endpoint only returns an active key of type `publishable`, never a secret key. Preview and production EAS environments should still be updated to the current key so all Store API calls work without a bootstrap round trip.
