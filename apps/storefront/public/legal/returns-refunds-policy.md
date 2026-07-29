# Returns & Refunds Policy

> **DRAFT — NOT LEGAL ADVICE. Requires review and approval before publication**, particularly for consumer-protection-law compliance in your jurisdiction(s) of operation (many places set a statutory minimum return window or disclosure requirement regardless of a merchant's own policy). Grounded in this platform's actual return/cancellation/refund mechanics as built (see `docs/PAYMENTS.md` §5–§6, `docs/MARKETPLACE-FLOWS.md`). Every bracketed value is a placeholder sourced from `business-config`. **Last updated:** `[legal.terms_last_updated]`.

## 1. Cancelling an order

You can cancel an order **free of charge, in full, at any time before the seller marks it "preparing."** Once you cancel:

- You receive a full refund of the amount charged, including any shipping and tax paid.
- Your cancellation request is processed automatically — no need to contact support unless the cancel option isn't available and you believe it should be.

Once a seller has started preparing your order, it can no longer be cancelled through self-service — see §2 for your return options after delivery instead.

## 2. Returning a delivered item

You may request a return within **`[returns.return_window_days]` days of delivery** for one of these reasons:

- **Damaged** — the item arrived physically damaged.
- **Defective** — the item doesn't work or function as described.
- **Incorrect item** — you received something different from what you ordered.
- **Change of mind** ("customer remorse") — you simply no longer want it.

To start a return, go to your order in your account and submit a return request with the reason and, where relevant, photos. The seller reviews the request and approves or denies it.

## 3. Return shipping

Our current policy: **`[returns.return_shipping_policy]`** — meaning, in short, you're responsible for return shipping costs unless the item was damaged, defective, incorrect, or otherwise materially different from what was listed, in which case return shipping is covered.

## 4. How refunds are issued

- Once a return is approved, a refund is issued to your original payment method via Stripe. `[Placeholder — expected refund processing time, e.g. "5–10 business days," depends on your card issuer once real (non-test-mode) payments are enabled — see docs/DEPLOYMENT.md §8.]`
- A denied return request leaves your order and payment unchanged; you'll be notified of the reason.
- Refunds are never partial without explanation — a full refund covers the full amount paid for the returned item; a partial refund (if applicable to your situation) will state clearly what portion is being refunded and why.

## 5. What happens to the item

If your return is approved for a restockable reason, the seller's inventory is updated accordingly. You do not need to worry about this — it happens automatically once your return is processed.

## 6. Disputes

If you dispute a charge directly with your bank or card issuer instead of using this platform's return process, that dispute is handled under our chargeback process (see `docs/PAYMENTS.md` §7) — we encourage you to contact us first, since most issues can be resolved faster through a direct return request than through a bank dispute.

## 7. Contact

Questions about a specific order's return eligibility, or this policy in general: **`[support.support_email]`**.
