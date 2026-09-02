# Production Launch Checklist

The single, ordered list to work through before Bawi Shopping takes its first real payment. Every item links to the document that explains it in full — this file is an index and a checklist, not a duplicate explanation. Nothing on this list has been done for you as "real" — every checkbox represents a placeholder, a decision, or a human action this session could not and should not take on its own (see `CLAUDE.md`'s action-category rules on hard-to-reverse and real-money actions).

A later production-prep pass built real, runnable scaffolding for most of §1-§3 and §11 with placeholder values throughout (`infra/terraform`, `load-testing/`) — see each section below for exactly what exists vs. what's still a manual step. Three things remain genuinely outside any agent's reach regardless of tooling: §7 (an attorney has to actually review the legal documents), actually running `terraform apply` against a real cloud account (no credentials exist in this environment), and §12's live-Stripe-key/feature-flag switch (a deliberate, human, real-money-enabling action - never automated, never defaulted to placeholder "just in case" values).

Work top to bottom. Don't skip ahead to §7 (go-live) without completing everything above it.

This checklist assumes the AWS/Terraform infrastructure path (`docs/DEPLOYMENT.md`, `infra/terraform/`). Before onboarding real vendors/customers, `docs/DEPLOYMENT-LOWCOST.md` describes a free/low-cost interim path (Vercel + Render/Railway + Supabase) for validating the product first — most of §2–§6 and §8–§11 below still apply there (feature flags, business config, security headers, legal review are infrastructure-independent); §1's specific AWS resources and §12's production Stripe go-live are what actually change when you're ready to move off the interim path.

## 1. Infrastructure provisioned

- [ ] A dedicated PostgreSQL database exists for this environment (14+), separate from every other environment's database (`docs/DEPLOYMENT.md` §3).
- [ ] Secrets generated and stored in the hosting provider's secret manager — `JWT_SECRET`, `COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY` (`openssl rand -hex 32`) — unique to this environment, never reused, never committed (`docs/DEPLOYMENT.md` §2.1, §5 step 2).
- [ ] **If running more than one backend instance**: a Redis instance is provisioned and `REDIS_URL` is set (`docs/DEPLOYMENT.md` §2.1, §9 — this switches the event bus/cache/locking/workflow-engine to their Redis-backed equivalents; skip this box for a genuine single-instance deployment).
- [ ] **If real product-image traffic at scale is expected**: S3 (or an S3-compatible provider) is provisioned and `S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` are set (`docs/DEPLOYMENT.md` §2.1, §8); otherwise local-disk storage is an explicit, accepted choice for now.
- [ ] Deployment mechanism chosen and tested — the Dockerfiles + `docker-compose.yml`, or `infra/terraform` (a real, `terraform validate`-clean AWS module provisioning all of the above in one `apply` — see `docs/DEPLOYMENT.md` §1 and `infra/terraform/README.md`; never applied against a real account by this session, since it has no AWS credentials), or an equivalent hosting-provider-native build. For the Terraform path specifically, `infra/terraform/DEPLOYMENT-SEQUENCE.md` has the full 9-phase walkthrough with checkpoints.

## 2. Backend deployed and migrated

- [ ] Backend deployed with every required environment variable set (`docs/DEPLOYMENT.md` §2.1) and `ENABLE_TEST_SUPPORT_ROUTES` unset or `false`.
- [ ] `npx medusa db:migrate` run against this environment's database and exits cleanly (`docs/DEPLOYMENT.md` §5 step 4).
- [ ] First admin user created: `npx medusa user -e you@example.com -p <a-real-password>` (`docs/DEPLOYMENT.md` §5 step 5).
- [ ] Publishable API key + sales channel created in the Medusa admin (`docs/DEPLOYMENT.md` §2.4, §5 step 6).

## 3. Stripe wired (test mode)

- [ ] Webhook endpoint registered against `<backend-url>/webhooks/stripe`, subscribed to at minimum `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `charge.dispute.created`, `charge.dispute.closed` (`docs/DEPLOYMENT.md` §2.4).
- [ ] `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set to **test-mode** values for this environment (`docs/DEPLOYMENT.md` §2.1) — do not set live keys yet; that's §8 below.

## 4. Frontends deployed

- [ ] `apps/storefront`, `apps/seller-portal`, `apps/admin` all deployed, each pointing `MEDUSA_BACKEND_URL` at this environment's backend (`docs/DEPLOYMENT.md` §2.2–§2.3).
- [ ] Storefront's `MEDUSA_PUBLISHABLE_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set.
- [ ] Backend's `SELLER_PORTAL_URL` and `COURIER_PORTAL_URL` point at this environment's real seller-portal and admin origins (`docs/DEPLOYMENT.md` §5 step 9).

## 5. End-to-end smoke test

- [ ] Register a customer → submit and approve a seller application → activate the seller → create and approve a product → add to cart → complete a test-mode checkout → confirm the Stripe webhook splits the order → confirm an in-app notification appears (`docs/DEPLOYMENT.md` §5 step 10).
- [ ] Confirm the storefront's `/legal/terms`, `/legal/privacy`, `/legal/returns`, `/legal/cookies`, `/legal/acceptable-use`, `/legal/dmca` pages render, and the footer links to all six.
- [ ] Confirm security headers are present on a live response (`curl -sI <url> | grep -i content-security-policy`) and match `docs/SECURITY.md` §16.

## 6. Business configuration reviewed

- [ ] Run `npx medusa exec ./src/scripts/check-production-readiness.ts` and read its full output (`docs/DEPLOYMENT.md` §4.1, §8).
- [ ] For every reported placeholder (`docs/DEPLOYMENT.md` §4.2), either replace it with a real, approved value via the admin `/config` UI, or consciously accept it as unnecessary for this launch and record that decision somewhere durable (a ticket, a decision doc) — never leave one unreviewed by default.
- [ ] Specifically confirm: commission rate, shipping fee, free-shipping threshold, return window and return-shipping policy, seller preparation deadline, cancellation cutoff, service area, support email and phone.

## 7. Legal documents reviewed

- [ ] A licensed attorney has reviewed and revised every document in `docs/legal/` (Terms of Service, Privacy Policy, Seller Agreement, Returns & Refunds Policy, Cookie Policy, Acceptable Use Policy, DMCA Policy) — see `docs/legal/README.md`.
- [ ] Every `legal` category business-config placeholder (`docs/DEPLOYMENT.md` §4.2–§4.3) replaced with the attorney-approved value.
- [ ] A real DMCA agent registered with the U.S. Copyright Office, matching `docs/legal/DMCA-POLICY.md` exactly.
- [ ] The "pending attorney review" draft banner removed from the storefront's `/legal/*` pages (`apps/storefront/src/features/legal/components/legal-document-page.tsx`) once the above is done.
- [ ] If you have customers in a jurisdiction with statutory data-subject rights (GDPR, CCPA, etc.), a privacy specialist has reviewed the Privacy Policy's rights/retention sections specifically.

## 8. Third-party integrations decided

- [ ] **Email**: decide whether to go live with `real_email_enabled` for this launch. If yes, `EMAIL_PROVIDER=sendgrid` (or another wired provider) with real credentials set, and `email.provider` updated in business-config (`docs/DEPLOYMENT.md` §8).
- [ ] **Object storage**: decide whether local-disk storage is acceptable for this launch's scale, or S3 needs to be wired first (`docs/DEPLOYMENT.md` §2.1, §8).
- [ ] **Tax**: decide whether the flat mock-rate adapter is acceptable for this launch, or a real jurisdiction-aware provider must be built and wired first (`docs/DEPLOYMENT.md` §8 — this is new code, not a config flip).
- [ ] **SMS**: decide whether SMS notifications are in scope for this launch at all (no code path sends SMS today).
- [ ] **Courier booking**: decide whether the existing in-app pickup/tracking-code model is sufficient, or a real external logistics API is needed first.

## 9. Security hardening confirmed

- [ ] Rate limiting active on `/auth/*`, `POST /seller-applications`, `POST /seller-activation/complete` (`docs/SECURITY.md` §16) — confirm by checking `apps/backend/src/api/middlewares.ts`.
- [ ] Security headers (CSP, HSTS, X-Frame-Options, etc.) confirmed present on all three frontends in this environment (§5 above).
- [ ] `npm audit` findings reviewed for this environment's dependency versions (`docs/SECURITY.md` §9); the `sharp`/`lodash`/`react-router` dependency-bump follow-up scheduled if not yet done.
- [ ] CORS allowlists (`STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS`) contain only this environment's real origins — no `localhost`, no wildcard.
- [ ] Session cookies confirmed `Secure` in this environment (only true once served over HTTPS).

## 10. Monitoring and backups

- [ ] Uptime monitoring wired against the backend and all three frontends (`docs/DEPLOYMENT.md` §7).
- [ ] Error tracking / APM installed in the backend and all three frontends — not present in this codebase by default; this is new setup, not a flag flip.
- [ ] Automated database backups (snapshots + point-in-time recovery) confirmed active with your Postgres host (`docs/DEPLOYMENT.md` §6).
- [ ] **A restore has actually been tested in staging** — not just assumed to work because backups exist.
- [ ] Log aggregation wired for backend + frontend stdout (`docs/DEPLOYMENT.md` §7).

## 11. Load and soak testing

- [ ] Real k6 scripts exist (`load-testing/smoke.js`, `load.js`, `soak.js`) and were genuinely dry-run locally this session (`load-testing/RESULTS.md`) — that only proves the tooling works, not real capacity.
- [ ] `load-testing/load.js` run against **this real deployed environment** (`k6 run -e BASE_URL=... -e BACKEND_URL=... load-testing/load.js`), reviewed for p95/p99 latency and error rate, and infrastructure right-sized (`infra/terraform/variables.tf`'s task CPU/memory, RDS instance class, ECS desired count) if it doesn't hold up.
- [ ] `load-testing/soak.js` run against a real staging environment with `SOAK_DURATION` overridden to several hours (not the local dry run's default), watching for drift over time (memory growth, slowly rising latency), not just a final pass/fail.

**A note on this session's own dry run**: the first local attempt at `load.js` stalled for 2h43m against what should have been a 3m30s script — diagnosed as sandbox-environment resource contention (this same session independently found and killed two unrelated stuck background processes earlier), not an application bug, confirmed by an immediate clean re-run. Don't assume a single load-test run — anomalous or clean — is the final word; run it more than once.

## 12. Go-live: switching mock values to real (do last, in order)

Full detail in `docs/DEPLOYMENT.md` §8. Do not start this section until §1–§11 above are all checked.

- [ ] Re-run `check-production-readiness.ts` one final time — zero unreviewed placeholders.
- [ ] Real provider integrations wired for anything you decided to enable in §8 above.
- [ ] `STRIPE_SECRET_KEY` swapped to a real `sk_live_...` value; a **new**, separate live-mode webhook endpoint registered with its own `STRIPE_WEBHOOK_SECRET`.
- [ ] `real_transfers_enabled`, `real_payouts_enabled`, `real_refunds_enabled` flipped, each confirmed against one real, small, controlled transaction before flipping the next.
- [ ] `live_payments_enabled` flipped last — the actual go-live moment.
- [ ] Readiness check re-run one more time immediately after, to confirm every flag landed where intended.

## 13. Mobile store submission

Before the mobile customer app is submitted to either store:

- [ ] Replace the mobile checkout's current "coming soon" screen with the approved Ethiopian payment rail, then complete a real-device test order through payment, order creation, notification, fulfillment, refund, and cancellation.
- [x] Provider-neutral Ethiopian payment contract is present and fails closed while `ETHIOPIAN_PAYMENT_PROVIDER=disabled`; install and register the chosen bank-specific adapter only after receiving its sandbox specification and credentials.
- [ ] Keep the in-app account-deletion flow enabled and verify it against staging with a disposable customer account.
- [ ] Publish the attorney-approved Privacy Policy at a public HTTPS URL, link it in App Store Connect and Play Console, and complete Apple privacy labels / Google Play Data safety answers from the production SDK and data inventory.
- [ ] Create signed production EAS builds and test them through TestFlight and a Google Play internal-testing track on physical phones; verify fresh install, upgrade, restart persistence, deep links, image upload, and push delivery.
- [ ] Confirm the release build points only to the production HTTPS backend and production publishable key; no localhost, test-support route, test account, or development secret may be present.
- [ ] Prepare store listing copy, screenshots for required device sizes, support and privacy URLs, content rating, review notes, and a working reviewer/demo account.
- [ ] Review unresolved production dependency advisories and document any temporarily accepted transitive risk before submission.

## 14. Post-launch

- [ ] Monitor error tracking, uptime, and Stripe Dashboard closely for the first 24–48 hours.
- [ ] Confirm the first few real orders complete their full lifecycle (payment capture → vendor-order split → fulfillment → delivery confirmation → payout eligibility) exactly as the smoke test in §5 predicted.
- [ ] Keep a rollback plan ready — know how to flip `live_payments_enabled` back to `false` and what that does and doesn't undo (it stops new live checkouts; it does not reverse an already-captured payment — see `docs/PAYMENTS.md`).
