// Generated from docs/legal/PRIVACY-POLICY.md - keep in sync by hand, same convention as
// apps/storefront/public/legal/privacy-policy.md (see docs/legal/README.md).
export const PRIVACY_POLICY = `# Privacy Policy

> **DRAFT — NOT LEGAL ADVICE. Requires review and approval by a licensed attorney (and, depending on your user base, a privacy/data-protection specialist for GDPR/CCPA/similar compliance) before publication or use.** Grounded in this platform's actual data flows as built (see \`docs/SECURITY.md\`, \`docs/DATABASE.md\`, \`docs/ARCHITECTURE.md\`) rather than generic boilerplate — but every bracketed value is a placeholder and every compliance-specific section is flagged for specialist review. **Last updated:** \`[legal.terms_last_updated]\`.

## 1. Who we are

**\`[legal.company_legal_name]\`** ("Bawi Shopping," "we," "us") operates the Bawi Shopping marketplace. This policy explains what personal information we collect, why, and how it's protected. Our registered address is **\`[legal.company_address]\`**; our privacy contact is **\`[legal.privacy_contact_email]\`**.

## 2. What we collect

| Who | What | Why |
|---|---|---|
| **Customers** | Name, email, password (stored as a salted hash, never plaintext), shipping/billing address, order history, in-app notification history | Account creation, order fulfillment, customer support, order-status notifications |
| **Sellers** | Business/store name, email, business address, staff-account details (role: owner/catalog manager/order fulfiller/analyst) | Seller account, product listing management, payouts |
| **Sellers (Stripe Connect)** | Bank account details, tax ID, identity-verification (KYC) documents | Collected and stored **directly by Stripe**, never by Bawi Shopping's own servers — we only ever see a Stripe-issued account status, never the underlying documents or bank details |
| **Couriers** | Name, login credentials, current delivery assignment | Coordinating pickup/delivery, proof-of-delivery confirmation |
| **Everyone** | IP address (for rate-limiting/abuse prevention only — see \`docs/SECURITY.md\` §16), basic request logs | Security, abuse prevention, debugging |

**We never store raw payment card data.** Card numbers, CVCs, and full card details are sent directly to Stripe by the browser (via Stripe's Payment Element) and never touch our servers — see \`docs/PAYMENTS.md\`.

## 3. What we deliberately do NOT share between parties

A core design principle of this platform (not just a policy statement — enforced in the code, see \`docs/SECURITY.md\` §11–§14):

- **Customers never see a Vendor's real identity, business name, or contact details** through any order, tracking, or notification screen.
- **Vendors never see a customer's name, phone number, email, or full address** — only what's minimally needed to prepare and label a shipment for pickup by our courier.
- **Couriers only ever see the one delivery they're currently assigned** — not a Vendor's or customer's broader account, order history, or contact details.

There is no direct Vendor-to-customer or customer-to-Vendor messaging feature on this platform; all communication about an order goes through Bawi Shopping.

## 4. How we use your information

- Processing and fulfilling orders (yours or, for a Vendor, the orders placed against their listings).
- Sending transactional notifications (order confirmation, shipment updates, refund/payout notices) — see §6 below on how these are currently sent.
- Customer support and dispute resolution.
- Fraud prevention and abuse mitigation (e.g., the rate-limiting described in \`docs/SECURITY.md\` §16).
- Legal compliance (tax reporting, responding to lawful requests from authorities).

**We do not sell your personal information.** \`[Placeholder — confirm this remains true before publishing; if any future advertising/analytics partner is introduced, this section and the associated opt-out mechanism must be updated and reviewed by counsel.]\`

## 5. Cookies and similar technologies

- We use **first-party, functional session cookies only** today: an httpOnly, \`Secure\` (in production), \`SameSite=Lax\` cookie per app (storefront, seller portal, admin/courier portal) that keeps you logged in, plus a similar cookie identifying a guest shopping cart before you register or log in.
- **We do not currently use third-party advertising or analytics tracking cookies.** If that changes, this section and our [Cookie Policy](COOKIE-POLICY.md) must be updated first, along with any required consent-banner mechanism for your jurisdiction(s).

## 6. Third parties we share data with

| Party | What they receive | Why |
|---|---|---|
| **Stripe** | Payment details, and — for sellers — bank/tax/KYC information for payouts | Payment processing and Stripe Connect seller payouts (see \`docs/PAYMENTS.md\`) |
| **Email provider** | Your email address and the content of transactional notifications, once a real provider is configured (see \`docs/DEPLOYMENT.md\` §8 — currently, notifications are logged internally only and no email actually sends) | Sending order/account notifications |
| **Object storage provider** | Product images only (never customer or seller PII) once real object storage is configured (see \`docs/DEPLOYMENT.md\` §8 — currently local disk storage) | Hosting product images |

We do not have any other third-party data-sharing relationships as of this document's last-updated date above.

## 7. Data retention

\`[Placeholder — retention periods for order history, audit logs, and account data after account closure are a business/legal decision, not yet made. Should address: how long order/financial records are kept (often driven by tax-law minimums), how long audit logs are retained, and what happens to a closed account's data.]\`

## 8. Your rights

Depending on your location, you may have rights to access, correct, delete, or export your personal information, and to object to certain processing. To exercise these rights, contact **\`[legal.privacy_contact_email]\`**.

\`[Placeholder — if you have users in the EU/UK (GDPR), California (CCPA/CPRA), or other jurisdictions with statutory data-subject rights, this section needs jurisdiction-specific language from a privacy specialist, including lawful-basis-for-processing disclosures and any required Data Processing Agreement with Stripe/other processors.]\`

## 9. Children's privacy

This platform is not directed to children under 13 (or the relevant minimum age in your jurisdiction), and we do not knowingly collect personal information from them.

## 10. Security

See our [Security documentation](../SECURITY.md) for the technical and organizational measures protecting your data — tenant isolation between sellers, audit logging of sensitive actions, rate limiting, security headers, and dependency review.

## 11. Changes to this policy

We may update this policy from time to time; the "Last updated" date above reflects the most recent revision.

## 12. Contact

Privacy questions or requests: **\`[legal.privacy_contact_email]\`**. General support: **\`[support.support_email]\`**.
`;
