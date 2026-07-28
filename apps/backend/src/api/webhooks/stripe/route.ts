import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"
import { createStripeConnectClient } from "../../../payments/stripe-client"
import { applyStripeAccountUpdatedWebhookWorkflow } from "../../../workflows/apply-stripe-account-updated-webhook"
import { captureCheckoutPaymentWorkflow } from "../../../workflows/capture-checkout-payment"
import { failCheckoutPaymentWorkflow } from "../../../workflows/fail-checkout-payment"
import { getOrCreateDefaultStockLocationId } from "../../../workflows/shared/default-stock-location"
import type { CheckoutLineItemSnapshot } from "../../../workflows/start-checkout"
import type { StripeConnectEvent } from "../../../payments/stripe-client"

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ""

/**
 * Public (no session required - Stripe calls this directly), but every
 * request is signature-verified before any parsing or side effect runs
 * (docs/SECURITY.md §4). Requires `bodyParser: { preserveRawBody: true }`
 * on this route (see middlewares.ts) so the exact bytes Stripe signed are
 * available for verification - the default JSON parser would break it.
 * Single receiver for every Stripe event type this platform consumes (see
 * docs/PAYMENTS.md §7) - account onboarding and checkout payment events
 * both land here, each dispatched to its own workflow.
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

  switch (event.type) {
    case "account.updated":
      await handleAccountUpdated(req, event)
      break
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(req, event)
      break
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(req, event)
      break
    default:
      // Every other event type is acknowledged (2xx) so Stripe doesn't keep
      // retrying it, but otherwise ignored until a later phase adds a
      // handler for it.
      break
  }

  res.status(200).json({ received: true })
}

async function handleAccountUpdated(req: MedusaRequest, event: StripeConnectEvent): Promise<void> {
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
    // from manual testing) - nothing to update.
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
}

async function findOrderForPaymentIntent(req: MedusaRequest, paymentIntentId: string) {
  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const [order] = await orderModuleService.listMarketplaceOrders({
    stripe_payment_intent_id: paymentIntentId,
  })
  return order
}

async function handlePaymentIntentSucceeded(
  req: MedusaRequest,
  event: StripeConnectEvent
): Promise<void> {
  const intent = event.data.object as { id: string }
  const order = await findOrderForPaymentIntent(req, intent.id)
  if (!order) {
    // No order references this PaymentIntent (e.g. a test/dev intent
    // created outside checkout) - nothing to capture.
    return
  }

  const locationId = await getOrCreateDefaultStockLocationId(req.scope)

  await captureCheckoutPaymentWorkflow(req.scope).run({
    input: {
      eventId: event.id,
      eventType: event.type,
      orderId: order.id,
      customerId: order.customer_id,
      reservationItemIds: (order.reservation_item_ids as unknown as string[]) ?? [],
      lineItemsSnapshot: order.line_items_snapshot as unknown as CheckoutLineItemSnapshot[],
      locationId,
    },
  })
}

async function handlePaymentIntentFailed(
  req: MedusaRequest,
  event: StripeConnectEvent
): Promise<void> {
  const intent = event.data.object as { id: string }
  const order = await findOrderForPaymentIntent(req, intent.id)
  if (!order) {
    return
  }

  await failCheckoutPaymentWorkflow(req.scope).run({
    input: {
      eventId: event.id,
      eventType: event.type,
      orderId: order.id,
      customerId: order.customer_id,
      reservationItemIds: (order.reservation_item_ids as unknown as string[]) ?? [],
    },
  })
}
