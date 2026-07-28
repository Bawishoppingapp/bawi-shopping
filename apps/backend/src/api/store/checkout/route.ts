import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { findActiveCart } from "../../../cart/cart-session"
import { refreshAndShapeCart } from "../../../cart/cart-response"
import { resolveCartVariants } from "../../../cart/cart-catalog"
import { calculateMockTax } from "../../../tax/tax-calculator"
import { startCheckoutSchema } from "../../../orders/schemas"
import { generateOrderDisplayId } from "../../../orders/display-id"
import { getOrCreateDefaultStockLocationId } from "../../../workflows/shared/default-stock-location"
import {
  startCheckoutWorkflow,
  type CheckoutLineItemSnapshot,
} from "../../../workflows/start-checkout"
import { BUSINESS_CONFIG_MODULE } from "../../../modules/business-config"
import type BusinessConfigModuleService from "../../../modules/business-config/service"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"
import { createStripePaymentClient } from "../../../payments/stripe-payment-client"

/**
 * Starts checkout for the authenticated customer's cart: final server-side
 * re-validation (reusing the exact same resolution the cart already
 * applies on every read - see docs/DECISIONS.md), one PaymentIntent on the
 * platform account, and one pending Order row. A retried request with the
 * same idempotency_key returns the existing result rather than creating a
 * second order/PaymentIntent (see docs/MARKETPLACE-FLOWS.md §1).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id

  const parsed = startCheckoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }
  const { shipping_address, idempotency_key } = parsed.data

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )

  const [existingOrder] = await orderModuleService.listMarketplaceOrders({
    customer_id: customerId,
    idempotency_key,
  })
  if (existingOrder) {
    if (existingOrder.status === "paid" || !existingOrder.stripe_payment_intent_id) {
      res.json({
        order_id: existingOrder.id,
        display_id: existingOrder.display_id,
        status: existingOrder.status,
        client_secret: null,
      })
      return
    }
    const paymentClient = createStripePaymentClient()
    const intent = await paymentClient.retrievePaymentIntent(existingOrder.stripe_payment_intent_id)
    res.json({
      order_id: existingOrder.id,
      display_id: existingOrder.display_id,
      status: existingOrder.status,
      client_secret: intent.clientSecret,
    })
    return
  }

  const cartConfig = await businessConfigModuleService.getCategoryValues("cart")
  const expirationDays = Number(cartConfig.cart_expiration_days ?? 30)
  const cart = await findActiveCart(req.scope, customerId, undefined, expirationDays)
  if (!cart || !cart.items.length) {
    res.status(409).json({ message: "Your cart is empty." })
    return
  }

  const publicCart = await refreshAndShapeCart(req.scope, cart)
  if (publicCart.checkout_blocked || !publicCart.items.length) {
    res.status(409).json({
      message: "One or more items in your cart need attention before you can check out.",
      cart: publicCart,
    })
    return
  }

  const variantIds = cart.items
    .map((item) => item.variant_id)
    .filter((id): id is string => !!id)
  const resolvedByVariantId = await resolveCartVariants(req.scope, variantIds)

  const lineItemsSnapshot: CheckoutLineItemSnapshot[] = []
  for (const item of cart.items) {
    const resolved = item.variant_id ? resolvedByVariantId.get(item.variant_id) : null
    if (!resolved) {
      // Re-validated moments ago by refreshAndShapeCart (checkout_blocked
      // was false) - this should be unreachable, but fails safe rather
      // than silently checking out an item with no resolvable vendor.
      res.status(409).json({
        message: "One or more items in your cart are no longer available.",
        cart: publicCart,
      })
      return
    }
    lineItemsSnapshot.push({
      variantId: resolved.variantId,
      vendorId: resolved.vendorId,
      productId: resolved.productId,
      productCode: resolved.productCode,
      title: resolved.title || item.title,
      thumbnail: resolved.thumbnail ?? item.thumbnail,
      color: resolved.color,
      size: resolved.size,
      unitPriceCents: resolved.unitPriceCents ?? item.unit_price,
      quantity: item.quantity,
      inventoryItemId: resolved.inventoryItemId,
    })
  }

  const taxConfig = await businessConfigModuleService.getCategoryValues("tax")
  const taxRateBasisPoints = Number(taxConfig.mock_rate_basis_points ?? 825)
  // Tax applies to the item subtotal only, not shipping - a common (not
  // universal) simplification; revisit once a real tax provider replaces
  // this mock adapter (see docs/DECISIONS.md).
  const taxResult = calculateMockTax(publicCart.subtotal, taxRateBasisPoints)

  const totalAmount = publicCart.subtotal + publicCart.shipping_estimate + taxResult.tax_amount
  const locationId = await getOrCreateDefaultStockLocationId(req.scope)
  const displayId = generateOrderDisplayId()

  try {
    const { result } = await startCheckoutWorkflow(req.scope).run({
      input: {
        customerId,
        displayId,
        currencyCode: publicCart.currency_code,
        idempotencyKey: idempotency_key,
        shippingAddress: shipping_address,
        lineItemsSnapshot,
        locationId,
        subtotalAmount: publicCart.subtotal,
        shippingAmount: publicCart.shipping_estimate,
        taxAmount: taxResult.tax_amount,
        taxRateBasisPoints,
        totalAmount,
      },
    })

    res.json({
      order_id: result.orderId,
      display_id: result.displayId,
      status: "pending_payment",
      client_secret: result.clientSecret,
    })
  } catch {
    res.status(500).json({ message: "Could not start checkout. Please try again." })
  }
}
