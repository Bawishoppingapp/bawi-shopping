import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { addCartItemSchema } from "../../../../cart/schemas"
import { CART_ID_HEADER, resolveOrCreateCart } from "../../../../cart/cart-session"
import { refreshAndShapeCart, type RawCart } from "../../../../cart/cart-response"
import { resolveCartVariant } from "../../../../cart/cart-catalog"
import { validateRequestedQuantity } from "../../../../cart/quantity"
import { addCartItemWorkflow } from "../../../../workflows/add-cart-item"
import { BUSINESS_CONFIG_MODULE } from "../../../../modules/business-config"
import type BusinessConfigModuleService from "../../../../modules/business-config/service"

const QUANTITY_ERROR_MESSAGES: Record<string, string> = {
  invalid: "Quantity must be a positive whole number.",
  exceeds_max: "Quantity exceeds the maximum allowed for this item.",
  exceeds_inventory: "Only a limited quantity is available.",
}

/**
 * The only route that ever creates a cart. Never trusts a client-supplied
 * price, vendor_id, or product-ownership claim - `variant_id` is the only
 * product reference accepted, and everything else (approval status,
 * current price, vendor ownership, live inventory) is re-resolved
 * server-side via resolveCartVariant before anything is written.
 */
export async function POST(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const parsed = addCartItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" })
    return
  }
  const { variant_id, quantity } = parsed.data

  const resolved = await resolveCartVariant(req.scope, variant_id)
  if (!resolved) {
    res.status(404).json({ message: "This product is not currently available for purchase." })
    return
  }

  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const cartConfig = await businessConfigModuleService.getCategoryValues("cart")
  const maxQuantityPerLineItem = Number(cartConfig.max_quantity_per_line_item ?? 10)
  const expirationDays = Number(cartConfig.cart_expiration_days ?? 30)

  const customerId = req.auth_context?.actor_id
  const header = req.headers[CART_ID_HEADER]
  const guestCartId = typeof header === "string" && header.length ? header : undefined

  const { cart } = await resolveOrCreateCart(req.scope, customerId, guestCartId, expirationDays)
  const cartModuleService = req.scope.resolve(Modules.CART)

  const existingItem = cart.items.find((item) => item.variant_id === resolved.variantId)
  const requestedTotalQuantity = (existingItem?.quantity ?? 0) + quantity

  const validation = validateRequestedQuantity(requestedTotalQuantity, {
    availableQuantity: resolved.availableQuantity,
    maxQuantityPerLineItem,
  })
  if (!validation.ok) {
    res.status(400).json({ message: QUANTITY_ERROR_MESSAGES[validation.reason] })
    return
  }

  await addCartItemWorkflow(req.scope).run({
    input: {
      cartId: cart.id,
      existingItemId: existingItem?.id,
      currentQuantity: existingItem?.quantity ?? 0,
      currentUnitPrice: existingItem?.unit_price,
      requestedQuantity: requestedTotalQuantity,
      unitPrice: resolved.unitPriceCents ?? 0,
      productId: resolved.productId,
      variantId: resolved.variantId,
      title: resolved.title,
      thumbnail: resolved.thumbnail ?? undefined,
      vendorId: resolved.vendorId,
      color: resolved.color,
      size: resolved.size,
    },
  })

  const refreshedCart = await cartModuleService.retrieveCart(cart.id, { relations: ["items"] })
  res.json({ cart: await refreshAndShapeCart(req.scope, refreshedCart as unknown as RawCart) })
}
