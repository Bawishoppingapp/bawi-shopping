# Pre-launch security review — 2026-08-26

Scope: mobile checkout, Stripe integration and webhooks, authentication-adjacent
seller/customer push-token endpoints, repository secret exposure, and current
dependency advisories. This is a code review, not a substitute for production
penetration testing or an infrastructure review of the eventual host.

## Verified controls

- Store checkout, order, wishlist, notification, and push-token routes require an
  authenticated customer; seller routes require an authenticated seller user.
- Checkout derives the customer from the authenticated actor and obtains price
  and order data server-side rather than trusting client totals.
- Stripe webhooks verify the signature against the raw request body.
- Stripe test doubles are restricted to the explicit test-support configuration.
- Seller Stripe onboarding derives seller identity from the authenticated actor.
- A scan of tracked source and configuration found no committed live/test secret
  values matching the reviewed Stripe, AWS, private-key, or mobile Stripe-key
  patterns. Environment files remain intentionally gitignored.

## Fixed during this review

- Customer and seller push-token endpoints previously accepted any nonempty
  string. They now share one bounded validator accepting only Expo's supported
  `ExpoPushToken[...]` and legacy `ExponentPushToken[...]` forms. This prevents
  malformed or oversized authenticated input from being persisted and sent to
  Expo's push service.
- Added focused validation coverage (10 tests). The complete backend unit suite
  passes: 27 suites and 223 tests. Backend type checking passes, and lint has no
  errors.
- Pinned `@expo/ui` to the intended beta release and Expo to its SDK 54 patch
  line. This prevents npm prerelease range resolution from installing an
  incompatible canary native module, which caused the first Android dev client
  to terminate at launch.
- Upgraded all four Next.js consumers in lockstep from 16.2.11 to 16.3.3 and
  every Medusa 2.x package in lockstep from 2.17.2 to 2.19.0. Repository-wide
  type checking, unit tests, lint, the three Next.js production builds, and the
  backend production build pass after the upgrade.

## Findings requiring planned follow-up

- After the coordinated Next.js and Medusa upgrades, `npm audit --omit=dev`
  reports 46 production-tree findings: 24 moderate, 22 high, and 0 critical
  (down from 76 total). The remaining findings are transitive, predominantly in
  Expo/native or framework tooling; npm's suggested remediation crosses major
  framework versions. Do not apply a bulk forced upgrade immediately before
  launch. Handle the remaining Expo SDK migration in an isolated branch and
  rebuild both native development clients.
- Backend lint reports 25 existing warnings, primarily direct service mutations
  in route handlers that Medusa recommends moving into workflows. There are no
  lint errors. Refactor these incrementally with integration coverage rather than
  as an unreviewed pre-launch rewrite.
- Error tracking/APM is not configured. Choose a provider, create the account and
  DSNs, then add backend and frontend integrations before inviting real users.
- A real-device push-delivery test remains mandatory. A simulator/browser
  emulator cannot validate APNs or FCM delivery end to end.
- Confirm production CORS allowlists, HTTPS-only secure cookies, rate limiting,
  headers, backup restore, and log/uptime monitoring against the deployed staging
  environment. These cannot be proven from source alone.

## Explicitly not changed

- No live payment, transfer, payout, refund, tax, email, SMS, or courier flags
  were enabled.
- No live Stripe credentials or other secrets were created, copied, or committed.
- No Apple/Google store accounts, legal approvals, monitoring accounts, hosting,
  or Ethiopia payout provider were fabricated or selected on the owner's behalf.

The authoritative remaining sequence is `docs/LAUNCH-CHECKLIST.md`. Live payment
flags remain the final step after staging, legal, operational, and provider work.
