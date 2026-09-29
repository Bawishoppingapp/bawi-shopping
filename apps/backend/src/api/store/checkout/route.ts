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
import { calculateAddressShipping } from "../../../shipping/address-shipping"
import { addCustomerMarkup } from "../../../pricing/customer-price"

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
    res.json({
      order_id: existingOrder.id,
      display_id: existingOrder.display_id,
      status: existingOrder.status,
      payment_status: existingOrder.payment_status,
      payment_method: existingOrder.payment_method,
      payment_recipient_name: existingOrder.payment_recipient_name,
      payment_recipient_phone: existingOrder.payment_recipient_phone,
      subtotal: existingOrder.subtotal_amount,
      shipping: existingOrder.shipping_amount,
      tax: existingOrder.tax_amount,
      total: existingOrder.total_amount,
      currency_code: existingOrder.currency_code,
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

  const [taxConfig, shippingConfig, commissionConfig] = await Promise.all([
    businessConfigModuleService.getCategoryValues("tax"),
    businessConfigModuleService.getCategoryValues("shipping"),
    businessConfigModuleService.getCategoryValues("commission"),
  ])
  // The approved initial-launch rule is no customer tax. Keep the fallback
  // at zero as well, so a missing config row cannot silently reintroduce the
  // obsolete 8.25% development rate during checkout.
  const taxRateBasisPoints = Number(taxConfig.mock_rate_basis_points ?? 0)
  const taxResult = calculateMockTax(publicCart.subtotal, taxRateBasisPoints)

  const shippingQuote = calculateAddressShipping(
    shipping_address,
    Number(shippingConfig.standard_shipping_fee_cents_etb ?? 15000),
    Number(shippingConfig.neighboring_shipping_fee_cents_etb ?? 25000)
  )
  if (!shippingQuote) {
    res.status(422).json({ message: "Delivery is currently available only in Addis Ababa and supported neighboring areas." })
    return
  }
  const markupRate = Number(commissionConfig.platform_default_rate_basis_points ?? 1000)
  for (const item of lineItemsSnapshot) {
    item.unitPriceCents = addCustomerMarkup(item.unitPriceCents, markupRate)
  }
  const totalAmount = publicCart.subtotal + shippingQuote.amount + taxResult.tax_amount
  const locationId = await getOrCreateDefaultStockLocationId(req.scope)
  const displayId = generateOrderDisplayId()
  const paymentConfig = await businessConfigModuleService.getCategoryValues("payment_methods")
  const paymentRecipientName = String(paymentConfig.telebirr_recipient_name ?? "")
  const paymentRecipientPhone = String(paymentConfig.telebirr_recipient_phone ?? "")

  if (!paymentRecipientName || !paymentRecipientPhone) {
    res.status(503).json({ message: "Telebirr checkout is not configured yet." })
    return
  }

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
        shippingAmount: shippingQuote.amount,
        taxAmount: taxResult.tax_amount,
        taxRateBasisPoints,
        totalAmount,
        paymentRecipientName,
        paymentRecipientPhone,
      },
    })

    res.json({
      order_id: result.orderId,
      display_id: result.displayId,
      status: "pending_payment",
      payment_status: "pending",
      payment_method: "manual_telebirr",
      payment_recipient_name: result.paymentRecipientName,
      payment_recipient_phone: result.paymentRecipientPhone,
      subtotal: publicCart.subtotal,
      shipping: shippingQuote.amount,
      tax: taxResult.tax_amount,
      total: totalAmount,
      currency_code: publicCart.currency_code,
    })
  } catch {
    res.status(500).json({ message: "Could not start checkout. Please try again." })
  }
}
