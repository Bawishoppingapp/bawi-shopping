/**
 * Plain, code-level templates rather than a DB-backed template table -
 * there is no content-authoring UI planned for this batch and no
 * localization requirement for transactional email (unlike storefront/
 * seller-portal/admin UI copy, see docs/DECISIONS.md), so a hand-written
 * function per event type is the simplest thing that actually works,
 * matching this project's "mock adapter only as complex as its first real
 * caller needs" precedent (see the mock tax adapter, src/tax/tax-calculator.ts).
 */

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function orderConfirmationTemplate(input: { displayId: string; total: number }) {
  return {
    subject: `Your Bawi Shopping order ${input.displayId} is confirmed`,
    body: `Thanks for your order! Order ${input.displayId} for ${formatUsd(input.total)} is confirmed and being prepared.`,
  }
}

export function shipmentUpdateTemplate(input: { fulfillmentCode: string }) {
  return {
    subject: `Your order ${input.fulfillmentCode} is on its way`,
    body: `Your order (${input.fulfillmentCode}) is now out for delivery.`,
  }
}

export function deliveryConfirmationTemplate(input: { fulfillmentCode: string }) {
  return {
    subject: `Your order ${input.fulfillmentCode} has been delivered`,
    body: `Your order (${input.fulfillmentCode}) has been delivered. We hope you love it!`,
  }
}

export function returnStatusChangedTemplate(input: {
  status: "approved" | "denied" | "refunded"
  reason: string
}) {
  const messages: Record<typeof input.status, string> = {
    approved: `Your return request has been approved and is being processed.`,
    denied: `Your return request has been denied. Contact support if you have questions.`,
    refunded: `Your refund has been processed and should appear on your original payment method soon.`,
  }
  return {
    subject: `Update on your return request (${input.reason})`,
    body: messages[input.status],
  }
}

export function refundProcessedTemplate(input: { amount: number }) {
  return {
    subject: `Your refund of ${formatUsd(input.amount)} has been processed`,
    body: `A refund of ${formatUsd(input.amount)} has been issued to your original payment method.`,
  }
}

export function payoutSentTemplate(input: { amount: number }) {
  return {
    subject: `Your payout of ${formatUsd(input.amount)} is on its way`,
    body: `A payout of ${formatUsd(input.amount)} has been sent to your connected Stripe account.`,
  }
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

export function sellerApplicationApprovedTemplate(input: { storeName: string; activationLink: string; resend?: boolean; sentAt?: Date }) {
  const body = `Congratulations! Your application for "${input.storeName}" has been approved.`
  const token = new URL(input.activationLink).searchParams.get("token") ?? ""
  const subject = input.resend
    ? `Your new Bawi seller activation link (${(input.sentAt ?? new Date()).toISOString()})`
    : "Your Bawi Shopping seller application has been approved"
  const instructions = "Already have a Bawi account? Use its existing password. Otherwise, create one."
  return {
    subject,
    body,
    emailBody: `${body}\n\nOpen this link to activate your seller account:\n${input.activationLink}\n\nActivation code for the Bawi app (copy the full code):\n${token}\n\n${instructions}\n\n${input.resend ? "This new link replaces previous activation links. " : ""}This link expires in 7 days. If you did not apply, you can ignore this email.`,
    html: `<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(input.activationLink)}" style="display:inline-block;padding:12px 18px;background:#312B26;color:#ffffff;text-decoration:none;border-radius:6px">Activate your seller account</a></p><p>If the button does not open, copy this link:<br><a href="${escapeHtml(input.activationLink)}">${escapeHtml(input.activationLink)}</a></p><p><strong>Activation code for the Bawi app:</strong><br><code style="overflow-wrap:anywhere">${escapeHtml(token)}</code></p><p>${instructions}</p><p>${input.resend ? "This new link replaces previous activation links. " : ""}This link expires in 7 days. If you did not apply, you can ignore this email.</p>`,
  }
}

export function sellerApplicationRejectedTemplate() {
  return {
    subject: `Update on your Bawi Shopping seller application`,
    body: `Thank you for your interest in selling on Bawi Shopping. After review, we're not able to move forward with your application at this time.`,
  }
}
