import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { createStripeConnectClient } from "../../../payments/stripe-client"
import { applyStripeAccountUpdatedWebhookWorkflow } from "../../../workflows/apply-stripe-account-updated-webhook"

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ""

/**
 * Public (no session required - Stripe calls this directly), but every
 * request is signature-verified before any parsing or side effect runs
 * (docs/SECURITY.md §4). Requires `bodyParser: { preserveRawBody: true }`
 * on this route (see middlewares.ts) so the exact bytes Stripe signed are
 * available for verification - the default JSON parser would break it.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const signature = req.headers["stripe-signature"] as string | undefined
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody

  if (!rawBody) {
    res.status(400).json({ message: "Missing request body" })
    return
  }

  const stripeClient = createStripeConnectClient()

  let event
  try {
    event = stripeClient.constructWebhookEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  } catch {
    res.status(400).json({ message: "Invalid signature" })
    return
  }

  if (event.type !== "account.updated") {
    // Only account.updated is handled in this slice - every other event
    // type is acknowledged (2xx) so Stripe doesn't keep retrying it, but
    // otherwise ignored until a later phase adds a handler for it.
    res.status(200).json({ received: true })
    return
  }

  const account = event.data.object as {
    id: string
    charges_enabled?: boolean
    payouts_enabled?: boolean
    details_submitted?: boolean
  }

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const [seller] = await sellerModuleService.listSellers({ stripe_account_id: account.id })

  if (!seller) {
    // A test/dev Stripe account not linked to any seller (e.g. leftover
    // from manual testing) - acknowledge so Stripe stops retrying, but
    // there's nothing to update.
    res.status(200).json({ received: true })
    return
  }

  await applyStripeAccountUpdatedWebhookWorkflow(req.scope).run({
    input: {
      eventId: event.id,
      eventType: event.type,
      sellerId: seller.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    },
  })

  res.status(200).json({ received: true })
}
