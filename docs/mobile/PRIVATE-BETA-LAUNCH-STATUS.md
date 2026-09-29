# Mobile Release Status

Last verified: 2026-09-28 (America/Chicago)

This file records the current iOS/Android release posture. The initial commerce flow is manual Telebirr transfer with private receipt upload and administrator verification; the older payment-disabled beta description is obsolete.

## Completed technical preparation

- Expo SDK 54 customer app is linked to `@bawishopping/mobile-customer` with iOS bundle identifier `com.bawishopping.mobilecustomer`.
- Preview and production EAS environments contain the public backend URL and Medusa publishable client key.
- Release guards reject localhost, non-HTTPS backend URLs, and missing publishable keys.
- App icon, splash screen, phone-only configuration, encryption declaration, privacy manifest, support URL, privacy URL, initial App Store copy, categories, age-rating draft, and manual-release preference are present.
- Manual Telebirr checkout shows the exact ETB total and recipient, accepts a reference and receipt, and requires authenticated admin approval before fulfillment.
- Customer tax is zero for the initial launch; the checkout fallback is also zero so missing configuration cannot restore the obsolete development tax rate.
- Mobile unit tests, typecheck, lint, Expo Doctor, and local platform exports passed in the previous release-preparation run.

## Infrastructure status

- Backend: `https://bawi-backend.onrender.com`
- Database: Supabase PostgreSQL
- Web applications: Vercel
- Expo/EAS production variables: configured

The Render free service can sleep and previously required roughly 90 seconds for its first request. This is acceptable only for development or a small invitation-only test. It must be upgraded or moved to an always-on host before App Review because reviewers need a reliably responsive backend.

## Items that still require an owner or physical device

- Create the Bawi Shopping record in App Store Connect.
- Supply the App Store Connect app ID, Apple Team ID, final copyright owner, review contact, and disposable customer/seller reviewer accounts.
- Create a signed production iOS build with Apple credentials and test that exact build on a physical iPhone through TestFlight.
- Capture clean screenshots from the tested build with approved products and no private customer data.
- Complete Apple's privacy and age-rating questionnaires and confirm all answers against the enabled production providers.
- Test registration, password reset email, account deletion, Telebirr proof approval/rejection, fulfillment, cancellation, and offline refund on the signed build.
- Confirm legal identity/contact text and every public policy page immediately before submission.

## Current automated blockers being tracked

- CI previously failed because the mobile readiness script still expected disabled checkout and the Medusa test server passed an unsupported `--no-color` argument. Both causes are repaired in the pending release-preparation change and must pass on GitHub after push.
- Dependency advisories are reviewed in `docs/SECURITY-DEPENDENCY-REVIEW-2026-09-01.md`; patched transitive versions are applied where compatible, while framework-major-only findings remain documented rather than force-upgraded immediately before release.

## Submission rule

Do not submit to App Review until CI is green, the backend is always-on, the exact TestFlight build passes the physical-iPhone checklist, reviewer accounts work, screenshots and disclosures are complete, and a test order finishes successfully.
