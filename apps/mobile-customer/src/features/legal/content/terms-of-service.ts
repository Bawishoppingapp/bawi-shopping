// Generated from docs/legal/TERMS-OF-SERVICE.md - keep in sync by hand, same convention as
// apps/storefront/public/legal/terms-of-service.md (see docs/legal/README.md).
export const TERMS_OF_SERVICE = `# Terms of Service

> **DRAFT — NOT LEGAL ADVICE. Requires review and approval by a licensed attorney before publication or use.** This document is engineering-generated scaffolding meant to accelerate legal counsel's work, grounded in this platform's actual, already-built mechanics (see \`docs/PRD.md\`, \`docs/PAYMENTS.md\`, \`docs/MARKETPLACE-FLOWS.md\`, \`docs/DECISIONS.md\`) rather than generic boilerplate. Every bracketed value below is a placeholder sourced from (or intended to be sourced from) the \`business-config\` module's \`legal\` category (see \`docs/DEPLOYMENT.md\` §4) and must be reviewed, corrected, and approved before this goes live. **Last updated:** \`[legal.terms_last_updated]\`.

## 1. Who these Terms are between

These Terms of Service ("Terms") govern your use of the Bawi Shopping marketplace, operated by **\`[legal.company_legal_name]\`** ("Bawi Shopping," "we," "us," or "our"), a company registered in **\`[legal.registered_agent_state]\`** with its registered address at **\`[legal.company_address]\`**.

## 2. Bawi Shopping is the merchant of record

For every purchase made through this platform, **you are buying from Bawi Shopping, not directly from the independent seller ("Vendor") whose product you selected.** Bawi Shopping:

- Is the merchant of record for the transaction and appears as such on your payment statement.
- Charges your payment method directly (via Stripe), issues your receipt, and is your point of contact for customer service, shipment tracking, returns, refunds, and disputes.
- Coordinates fulfillment with the Vendor but does not disclose the Vendor's identity, business name, or contact details to you, and does not disclose your identity or contact details to the Vendor, beyond what's strictly necessary to fulfill and deliver your order (see our [Privacy Policy](PRIVACY-POLICY.md)).

This structure means: if something goes wrong with your order, you contact Bawi Shopping — not the Vendor directly. There is no direct Vendor-to-customer communication channel on this platform.

## 3. Accounts

- You must provide accurate information when creating a customer account and keep your login credentials confidential.
- You are responsible for all activity under your account.
- We may suspend or terminate an account for violating these Terms, our [Acceptable Use Policy](ACCEPTABLE-USE-POLICY.md), or applicable law.

## 4. Orders, pricing, and availability

- Prices are shown in USD and may include or exclude tax and shipping depending on the checkout flow; the final total is confirmed before you pay.
- Product availability, price, and eligibility are re-verified at the moment of checkout, not just when you added an item to your cart — an item can sell out or its price/availability can change between adding to cart and checkout.
- We reserve the right to cancel an order (in whole or part) if a product turns out to be unavailable, mispriced, or otherwise cannot be fulfilled, with a full refund of any amount charged for the cancelled portion.

## 5. Payment

- Payment is processed by Stripe. We never store your full card number, CVC, or other raw card data — that data goes directly to Stripe.
- By placing an order you authorize us to charge your chosen payment method for the full order total (including applicable shipping and tax).

## 6. Shipping, delivery, and privacy of fulfillment

- Vendors prepare orders for pickup by a Bawi Shopping-coordinated courier; delivery and tracking are managed by us, not the Vendor directly.
- Estimated delivery windows are provided at checkout and in your order confirmation; they are estimates, not guarantees.
- Proof of delivery is confirmed via a delivery code shown to you and provided to the courier at handoff.

## 7. Returns, refunds, and cancellations

Full detail is in our [Returns & Refunds Policy](RETURNS-REFUNDS-POLICY.md). In summary:

- You may cancel an order before the Vendor begins preparing it.
- You may request a return within **\`[returns.return_window_days]\` days** of delivery for a qualifying reason (damaged, defective, incorrect item, or change of mind).
- Return shipping responsibility follows our stated policy: **\`[returns.return_shipping_policy]\`**.

## 8. Vendor listings and content

- Vendors are independent businesses responsible for the accuracy of their own product listings (description, condition, sizing, images), subject to our review and approval before anything goes live.
- We do not guarantee that any Vendor listing is accurate, complete, or non-infringing, though we do review listings and respond to reports (see our [DMCA Policy](DMCA-POLICY.md) for intellectual-property complaints).

## 9. Prohibited conduct

See our [Acceptable Use Policy](ACCEPTABLE-USE-POLICY.md) for the full list. In short: no fraud, no circumventing our fee/commission structure by arranging off-platform payment, no attempting to identify or directly contact a Vendor or customer outside the platform's own tools, no illegal or counterfeit goods.

## 10. Disclaimers and limitation of liability

\`[Placeholder — this section requires attorney drafting specific to your jurisdiction(s) of operation, product categories, and risk tolerance. At minimum it should address: "as-is" disclaimers for third-party (Vendor) content, limitation of liability caps, and carve-outs for claims that cannot be limited by law (e.g., gross negligence, willful misconduct, certain consumer-protection statutes).]\`

## 11. Dispute resolution and governing law

\`[Placeholder — governing law, venue, and whether arbitration/class-action-waiver clauses apply are jurisdiction- and risk-tolerance-specific decisions that require attorney input. Currently assumed governing law: [legal.registered_agent_state].]\`

## 12. Changes to these Terms

We may update these Terms from time to time. Material changes will be reflected by updating the "Last updated" date above; continued use of the platform after a change constitutes acceptance of the updated Terms.

## 13. Contact

Questions about these Terms: **\`[support.support_email]\`**.
`;
