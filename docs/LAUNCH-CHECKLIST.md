# Production Launch Checklist

The single, ordered list to work through before Bawi Shopping takes its first real payment. Every item links to the document that explains it in full — this file is an index and a checklist, not a duplicate explanation. Nothing on this list has been done for you as "real" — every checkbox represents a placeholder, a decision, or a human action this session could not and should not take on its own (see `CLAUDE.md`'s action-category rules on hard-to-reverse and real-money actions).

Work top to bottom. Don't skip ahead to §7 (go-live) without completing everything above it.

## 1. Infrastructure provisioned

- [ ] A dedicated PostgreSQL database exists for this environment (14+), separate from every other environment's database (`docs/DEPLOYMENT.md` §3).
- [ ] Secrets generated and stored in the hosting provider's secret manager — `JWT_SECRET`, `COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY` (`openssl rand -hex 32`) — unique to this environment, never reused, never committed (`docs/DEPLOYMENT.md` §2.1, §5 step 2).
- [ ] **If running more than one backend instance**: a Redis instance is provisioned and `REDIS_URL` is set (`docs/DEPLOYMENT.md` §2.1, §9 — this switches the event bus/cache/locking/workflow-engine to their Redis-backed equivalents; skip this box for a genuine single-instance deployment).
- [ ] **If real product-image traffic at scale is expected**: S3 (or an S3-compatible provider) is provisioned and `S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` are set (`docs/DEPLOYMENT.md` §2.1, §8); otherwise local-disk storage is an explicit, accepted choice for now.
- [ ] Deployment mechanism chosen and tested — either the Dockerfiles + `docker-compose.yml` (`docs/DEPLOYMENT.md` §1) or an equivalent hosting-provider-native build.

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

- [ ] Real load testing performed against this environment under a realistic traffic profile (`docs/IMPLEMENTATION-PLAN.md` — explicitly flagged as needing infrastructure this development sandbox couldn't provide).
- [ ] A staging soak test (the environment left running under light real traffic for an extended period) completed with no unexpected errors or memory growth.

## 12. Go-live: switching mock values to real (do last, in order)

Full detail in `docs/DEPLOYMENT.md` §8. Do not start this section until §1–§11 above are all checked.

- [ ] Re-run `check-production-readiness.ts` one final time — zero unreviewed placeholders.
- [ ] Real provider integrations wired for anything you decided to enable in §8 above.
- [ ] `STRIPE_SECRET_KEY` swapped to a real `sk_live_...` value; a **new**, separate live-mode webhook endpoint registered with its own `STRIPE_WEBHOOK_SECRET`.
- [ ] `real_transfers_enabled`, `real_payouts_enabled`, `real_refunds_enabled` flipped, each confirmed against one real, small, controlled transaction before flipping the next.
- [ ] `live_payments_enabled` flipped last — the actual go-live moment.
- [ ] Readiness check re-run one more time immediately after, to confirm every flag landed where intended.

## 13. Post-launch

- [ ] Monitor error tracking, uptime, and Stripe Dashboard closely for the first 24–48 hours.
- [ ] Confirm the first few real orders complete their full lifecycle (payment capture → vendor-order split → fulfillment → delivery confirmation → payout eligibility) exactly as the smoke test in §5 predicted.
- [ ] Keep a rollback plan ready — know how to flip `live_payments_enabled` back to `false` and what that does and doesn't undo (it stops new live checkouts; it does not reverse an already-captured payment — see `docs/PAYMENTS.md`).
