# Legal & Policy Documents

Every document in this directory is a **draft template, not final legal advice** — see the banner at the top of each file. They exist so that, when you're ready to launch, an attorney has a concrete, platform-accurate starting point to review rather than a blank page or generic boilerplate.

| Document | Covers |
|---|---|
| [`TERMS-OF-SERVICE.md`](TERMS-OF-SERVICE.md) | Customer-facing terms: merchant-of-record structure, accounts, orders, payment, returns, liability |
| [`PRIVACY-POLICY.md`](PRIVACY-POLICY.md) | What data is collected, from whom, why, and the explicit customer/seller identity-separation guarantee |
| [`SELLER-AGREEMENT.md`](SELLER-AGREEMENT.md) | Seller-facing terms: commission, Stripe Connect payouts, listing obligations, fulfillment deadlines |
| [`RETURNS-REFUNDS-POLICY.md`](RETURNS-REFUNDS-POLICY.md) | Customer-facing cancellation/return/refund process and timing |
| [`COOKIE-POLICY.md`](COOKIE-POLICY.md) | What cookies are set and why (functional-only today, no third-party tracking) |
| [`ACCEPTABLE-USE-POLICY.md`](ACCEPTABLE-USE-POLICY.md) | Prohibited conduct for customers, sellers, and everyone else |
| [`DMCA-POLICY.md`](DMCA-POLICY.md) | Copyright notice-and-takedown process |

## Every bracketed value is a placeholder

Every `[category.key]` reference (e.g. `[legal.company_legal_name]`) corresponds directly to a row in the `business-config` module's `legal` category (see `docs/DEPLOYMENT.md` §4.2) — the same mechanism used for every other business decision on this platform (commission rate, return window, shipping fee, and so on).

**Before publishing any of these documents:**

1. Have a licensed attorney review and revise every document in this directory — they are drafts, not final text.
2. Replace every `business-config` `legal` category placeholder with the real, attorney-approved value via the admin `/config` UI or `PUT /admin/business-config/:category/:key` (see `docs/DEPLOYMENT.md` §4.1).
3. Run `npx medusa exec ./src/scripts/check-production-readiness.ts` to confirm no `legal` category placeholder remains.
4. Only then publish the reviewed documents as live pages (see `apps/storefront/src/app/legal/` for the storefront's placeholder pages that currently render these drafts with a "not yet reviewed" banner) and link them from checkout, account creation, and the seller-application flow as your attorney advises.

This directory, and the storefront pages that reference it, are explicitly **not** a substitute for legal counsel — they exist to save that counsel time, not to replace their review.
