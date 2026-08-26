// Generated from docs/legal/COOKIE-POLICY.md - keep in sync by hand, same convention as
// apps/storefront/public/legal/cookie-policy.md (see docs/legal/README.md).
export const COOKIE_POLICY = `# Cookie Policy

> **DRAFT — NOT LEGAL ADVICE. Requires review before publication**, particularly to confirm whether a cookie-consent banner is legally required for your user base (e.g., under GDPR/ePrivacy rules for EU/UK visitors) — this platform currently uses only strictly-necessary functional cookies, which are generally exempt from consent requirements, but that determination should be confirmed by counsel, especially if analytics/advertising cookies are introduced later. **Last updated:** \`[legal.terms_last_updated]\`.

## What cookies we use

Bawi Shopping currently uses **only first-party, strictly-necessary functional cookies** — no third-party advertising or analytics tracking cookies.

| Cookie | Set by | Purpose | Type |
|---|---|---|---|
| Storefront session | Storefront app | Keeps you logged in as a customer | httpOnly, \`Secure\` (production), \`SameSite=Lax\` |
| Guest cart identifier | Storefront app | Identifies your shopping cart before you register or log in | httpOnly, \`Secure\` (production), \`SameSite=Lax\` |
| Seller portal session | Seller portal app | Keeps a seller user logged in | httpOnly, \`Secure\` (production), \`SameSite=Lax\` |
| Admin/courier session | Admin app | Keeps an admin user or courier logged in | httpOnly, \`Secure\` (production), \`SameSite=Lax\` |

Every session cookie above is \`httpOnly\` — it cannot be read by JavaScript running in your browser, including any script on this site — and is scoped to only the one app that sets it (a storefront session cookie, for example, isn't sent to the seller portal or admin app).

## What we don't use

- No third-party advertising cookies or pixels.
- No cross-site tracking.
- No analytics cookies as of this document's last-updated date above. \`[Placeholder — if an analytics provider is added later, this policy and any required consent mechanism must be updated first, with counsel input on what's required in your jurisdiction(s).]\`

## Managing cookies

Since the cookies above are required for the site to function (staying logged in, keeping your cart), blocking them in your browser will prevent core features (login, checkout) from working correctly.

## Changes to this policy

If our cookie usage changes — for example, if we introduce analytics or add a new app — this policy will be updated first, along with any required consent mechanism.

## Contact

**\`[legal.privacy_contact_email]\`**.
`;
