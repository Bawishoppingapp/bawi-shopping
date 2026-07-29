# Seller Agreement

> **DRAFT — NOT LEGAL ADVICE. Requires review and approval by a licensed attorney before publication or use**, particularly given this agreement covers commission/payout economics, a merchant-of-record structure, and Stripe Connect obligations. Grounded in this platform's actual built mechanics (see `docs/PAYMENTS.md`, `docs/MARKETPLACE-FLOWS.md`, `docs/DECISIONS.md`). Every bracketed value is a placeholder. **Last updated:** `[legal.terms_last_updated]`.

## 1. Parties and scope

This Seller Agreement ("Agreement") is between **`[legal.company_legal_name]`** ("Bawi Shopping," "we," "us") and the business or individual applying to sell on the Bawi Shopping marketplace ("Seller," "you"). It governs your participation as a seller from application through account termination.

## 2. Application and approval

- Your seller application is reviewed by Bawi Shopping staff before your account is activated. We may approve, reject, or request more information at our discretion.
- Once approved, you'll receive an activation link to set up your seller account and invite staff (owner, catalog manager, order fulfiller, or analyst roles).
- We may suspend or terminate your seller account for violating this Agreement, our [Acceptable Use Policy](ACCEPTABLE-USE-POLICY.md), or applicable law.

## 3. Bawi Shopping is the merchant of record — what this means for you

Bawi Shopping, not you, is the merchant of record for every sale of your products through this platform. Practically, this means:

- **Customers pay Bawi Shopping, not you directly.** We charge the customer's payment method, and separately transfer your earnings to you via Stripe Connect (see §6).
- **We control the customer relationship**: customer service, returns, refunds, and disputes are handled by Bawi Shopping. You do not have a direct communication channel to customers, and customers do not have one to you (see our [Privacy Policy](../legal/PRIVACY-POLICY.md) §3) — all fulfillment coordination goes through this platform.
- **You are responsible for the accuracy of your listings** (description, condition, sizing, images) and for the quality and legality of the products you sell, notwithstanding our merchant-of-record role in processing the sale.

## 4. Stripe Connect account and payouts

- To receive payouts, you must complete Stripe Connect Express onboarding, including any identity-verification (KYC) documentation Stripe requires. This information is provided directly to Stripe — Bawi Shopping never sees or stores your bank details or verification documents.
- **Commission**: Bawi Shopping deducts a commission on each sale, currently **`[commission.platform_default_rate_basis_points]` basis points** (subject to a seller- or category-specific override, at our discretion), from your gross sale amount before transfer.
- **Transfer hold period**: your earnings on an order become eligible for payout **`[transfer_timing.transfer_hold_days]` days** after the customer's delivery is confirmed — not at the moment of sale. This hold exists to cover the return/dispute window described in §7.
- Payout batches are triggered by Bawi Shopping; a payout moves your available balance to your connected Stripe account via a Stripe Connect transfer.
- **Refund-after-payout**: if a refund is issued on an order whose earnings have already been paid out, the resulting negative balance is reconciled manually by Bawi Shopping (see `docs/PAYMENTS.md` §6) — you may be contacted to arrange repayment in that scenario.

## 5. Product listings and fulfillment obligations

- Every new product listing (and, if applicable, product-content translation) is reviewed and must be approved by Bawi Shopping before it's visible to customers.
- Once an order is placed against your listing, you must mark it "preparing" and then "ready for pickup" within **`[preparation.seller_preparation_deadline_hours]` hours** of the order being placed.
- A pickup code is generated once you mark an order ready for pickup; our courier presents this code to you, and you release the order to them only upon a matching code.
- **Your private per-variant SKU is never shown to customers** — only the platform's own public product code is customer-facing.

## 6. Returns, cancellations, and disputes

- A customer may cancel an order before you mark it "preparing"; a full refund and commission reversal are issued automatically, with no action required from you.
- A customer may request a return within **`[returns.return_window_days]` days** of delivery for a qualifying reason. If a return is approved, your commission on that portion of the sale is reversed proportionally, and (for restockable reasons) inventory is restored automatically.
- If a customer disputes a charge with their bank/card issuer (a "chargeback"), the associated balance is frozen pending resolution — see `docs/PAYMENTS.md` §7 for how disputes are handled.

## 7. Fees and commission changes

`[Placeholder — whether/how Bawi Shopping may change the commission rate, transfer-hold period, or other economic terms for existing sellers (vs. only new sellers going forward) is a business/legal decision requiring attorney input on notice requirements.]`

## 8. Staff accounts

You may invite co-workers under your seller account with one of three roles (catalog manager, order fulfiller, analyst); you, as the account owner, are responsible for their actions under your account and for removing access when appropriate.

## 9. Prohibited conduct

See our [Acceptable Use Policy](ACCEPTABLE-USE-POLICY.md). Specifically prohibited for sellers: attempting to identify or directly contact a customer outside the platform's own tools, arranging off-platform payment to avoid commission, listing counterfeit, stolen, recalled, or otherwise illegal goods, and manipulating reviews or ratings (if/when introduced).

## 10. Term and termination

Either party may terminate this Agreement `[placeholder — notice period, e.g. 30 days, subject to attorney input]`. Bawi Shopping may suspend or terminate immediately for a material violation of this Agreement, fraud, or a legal requirement to do so. Termination does not relieve either party of obligations already accrued (e.g., a pending payout for a delivered, non-disputed order).

## 11. Disclaimers, liability, and governing law

`[Placeholder — same attorney-drafting note as Terms of Service §10–§11: liability caps, indemnification (particularly for a seller's product liability, given Bawi Shopping is merchant of record but the seller controls the product itself), and governing law/venue.]`

## 12. Contact

**`[support.support_email]`**.
