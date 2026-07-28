import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { updateCartItemSchema } from "../../../../../cart/schemas"
import { CART_ID_HEADER, findActiveCart } from "../../../../../cart/cart-session"
import { refreshAndShapeCart, type RawCart } from "../../../../../cart/cart-response"
import { resolveCartVariant } from "../../../../../cart/cart-catalog"
import { validateRequestedQuantity } from "../../../../../cart/quantity"
import { updateCartItemQuantityWorkflow } from "../../../../../workflows/update-cart-item-quantity"
import { removeCartItemWorkflow } from "../../../../../workflows/remove-cart-item"
import { BUSINESS_CONFIG_MODULE } from "../../../../../modules/business-config"
import type BusinessConfigModuleService from "../../../../../modules/business-config/service"

const QUANTITY_ERROR_MESSAGES: Record<string, string> = {
  invalid: "Quantity must be a positive whole number.",
  exceeds_max: "Quantity exceeds the maximum allowed for this item.",
  exceeds_inventory: "Only a limited quantity is available.",
}

function guestCartId(req: MedusaStoreRequest): string | undefined {
  const header = req.headers[CART_ID_HEADER]
  return typeof header === "string" && header.length ? header : undefined
}

/**
 * Both routes below resolve the caller's own cart first (never trust the
 * :id in the URL alone) and 404 if the line item doesn't belong to it -
 * this is what stops a guest/customer from mutating another cart's items
 * by guessing a line item id.
 */
async function resolveOwnedCart(req: MedusaStoreRequest) {
  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const cartConfig = await businessConfigModuleService.getCategoryValues("cart")
  const expirationDays = Number(cartConfig.cart_expiration_days ?? 30)
  const maxQuantityPerLineItem = Number(cartConfig.max_quantity_per_line_item ?? 10)

  const customerId = req.auth_context?.actor_id
  const cart = await findActiveCart(req.scope, customerId, guestCartId(req), expirationDays)

  return { cart, maxQuantityPerLineItem }
}

export async function PATCH(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const parsed = updateCartItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" })
    return
  }

  const { cart, maxQuantityPerLineItem } = await resolveOwnedCart(req)
  const lineItemId = req.params.id
  const item = cart?.items.find((i) => i.id === lineItemId)
  if (!cart || !item) {
    res.status(404).json({ message: "Cart item not found" })
    return
  }

  if (!item.variant_id) {
    res.status(404).json({ message: "This item is no longer available" })
    return
  }
  const resolved = await resolveCartVariant(req.scope, item.variant_id)
  if (!resolved) {
    res.status(404).json({ message: "This item is no longer available - remove it to continue" })
    return
  }

  const validation = validateRequestedQuantity(parsed.data.quantity, {
    availableQuantity: resolved.availableQuantity,
    maxQuantityPerLineItem,
  })
  if (!validation.ok) {
    res.status(400).json({ message: QUANTITY_ERROR_MESSAGES[validation.reason] })
    return
  }

  await updateCartItemQuantityWorkflow(req.scope).run({
    input: {
      lineItemId: item.id,
      quantity: parsed.data.quantity,
      previousQuantity: item.quantity,
    },
  })

  const cartModuleService = req.scope.resolve(Modules.CART)
  const refreshedCart = await cartModuleService.retrieveCart(cart.id, { relations: ["items"] })
  res.json({ cart: await refreshAndShapeCart(req.scope, refreshedCart as unknown as RawCart) })
}

export async function DELETE(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const { cart } = await resolveOwnedCart(req)
  const lineItemId = req.params.id
  const item = cart?.items.find((i) => i.id === lineItemId)
  if (!cart || !item) {
    res.status(404).json({ message: "Cart item not found" })
    return
  }

  await removeCartItemWorkflow(req.scope).run({ input: { lineItemId: item.id } })

  const cartModuleService = req.scope.resolve(Modules.CART)
  const refreshedCart = await cartModuleService.retrieveCart(cart.id, { relations: ["items"] })
  res.json({ cart: await refreshAndShapeCart(req.scope, refreshedCart as unknown as RawCart) })
}
