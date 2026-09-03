# Private Beta Launch Status

Last verified: 2026-09-02 (America/Chicago)

This is the operational status for the payment-disabled Bawi Shopping private beta. It separates completed technical work from owner, legal, store-account, and provider actions that must not be guessed or enabled automatically.

## Step 1 — Staging hosting

**Status: complete for private beta.**

- Low-cost approach selected: Render backend plus Supabase PostgreSQL.
- Backend: `https://bawi-backend.onrender.com`
- `/health` returned `OK` during the latest verification.
- Supabase staging project was resumed.
- Render's free instance may sleep and have a slow first request. This is acceptable for a small private beta, not a production SLA.

## Step 2 — Staging mobile connection

**Status: complete for private beta.**

- The EAS `preview` environment contains the public HTTPS backend URL and a Medusa publishable key.
- Secrets and database credentials are not stored in the repository.
- Preview, iOS Simulator, and Play-internal profiles use preview services.
- The release-environment guard rejects localhost, non-HTTPS URLs, and missing publishable keys for every release-capable profile.
- Android internal-install APK and iOS Simulator artifacts have built successfully.
- A Play-compatible Android App Bundle (`.aab`, version code 2) has built successfully but must not be submitted until a Google Play developer account exists.
- The existing APK/AAB predate the password-reset delivery fix. Produce one fresh beta build after transactional email is configured instead of spending another free build now.

## Step 3 — Business and legal identity

**Status: owner input deferred; does not block invitation-only testing.**

The company is not registered yet. Legal name, registration jurisdiction/number, mailing address, support and privacy contacts, DMCA contact, launch countries, and minimum age remain intentionally unset. Do not replace these with guesses. This blocks public launch and final legal text, not a controlled payment-disabled beta.

## Step 4 — Business policies

**Status: owner decisions deferred; payment and commerce completion remain disabled.**

Commission, payout delay, return window, return-shipping responsibility, ETB shipping fee, free-shipping threshold, preparation deadline, cancellation cutoff, service area, and restricted products remain placeholders until approved by the owner and counsel. Beta testers may exercise browse/account/cart UI, but must not be promised purchasable inventory, delivery, refunds, or payouts.

## Step 5 — Legal review

**Status: attorney review deferred; internal beta permitted.**

- Drafts and the legal-review handoff exist under `docs/legal/`.
- The privacy data inventory exists at `docs/mobile/PRIVACY-DATA-INVENTORY.md`.
- Draft banners and placeholders must remain visible until counsel approves replacements.
- Do not publish or submit a public store release before approval.

## Step 6 — Store accounts

**Status: deferred.**

- Apple Developer membership is deferred to avoid fees; physical-iPhone distribution is unavailable. Simulator testing remains available.
- No Google Play Console developer account exists. The `.aab` is ready for later internal-track upload, but no registration fee or store submission is authorized.
- Public privacy/support URLs, final developer identity, listing copy, screenshots, declarations, and reviewer accounts remain pending.

## Step 7 — Non-payment providers

**Status: partially complete.**

- Staging database/backend: active on Supabase/Render.
- Transactional email: code path fixed, provider still log-only. SendGrid account, verified sender, and mail-send-only API key are owner-deferred. Password-reset delivery is not complete until a real inbox test passes.
- Product image storage: current low-cost/local choice is suitable only for limited beta use; durable object storage is pending.
- Error tracking/APM, uptime alerts, Redis, backup-restore test, and production-grade database resources remain pending.

## Step 8 — Ethiopian payment provider

**Status: safely deferred.**

- `ETHIOPIAN_PAYMENT_PROVIDER=disabled` remains the required beta state.
- The provider-neutral gateway fails closed.
- No bank credentials, payment API, live transfers, payouts, refunds, or customer payment entry are enabled.
- Provider selection and certification inputs remain documented in `docs/ETHIOPIAN-PAYMENT-INTEGRATION.md`.

## Current automated evidence

- Expo Doctor: 18/18 checks passed.
- Mobile customer tests: 111 passed.
- Backend unit tests: 229 passed.
- Workspace typecheck: passed.
- Lint: passed with documented non-blocking warnings.
- Private-beta static readiness: passed.
- Final PostgreSQL integration CI is rerunning with separate migration and test pool limits.

## Next owner-free action

Wait for the final CI run to finish. If it passes, preserve the completed artifacts and begin manual simulator/APK smoke testing. If it fails, diagnose the exact failing integration suite before creating another beta build.
