import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resolveCartVariant } from "./cart-catalog"
import { BUSINESS_CONFIG_MODULE } from "../modules/business-config"
import type BusinessConfigModuleService from "../modules/business-config/service"

interface RawLineItem {
  id: string
  variant_id: string | null
  quantity: number
  unit_price: number
}

interface RawCartRow {
  id: string
  customer_id: string | null
  items: RawLineItem[]
}

/**
 * Merges a guest cart into the authenticated customer's cart on login.
 * Idempotent: a guest cart already claimed by this same customer (a
 * repeated call, e.g. a retried request) is a no-op; a guest cart claimed
 * by a *different* customer (or missing entirely) is ignored rather than
 * merged. Quantity conflicts are resolved by summing and capping to live
 * inventory and the configurable per-line-item maximum - never rejected,
 * since a login flow shouldn't fail over a stock conflict (see
 * docs/PRD.md §9.10).
 */
export async function mergeGuestCartIntoCustomerCart(
  container: MedusaContainer,
  customerId: string,
  guestCartId: string | undefined
): Promise<string | null> {
  const cartModuleService = container.resolve(Modules.CART)

  const customerCarts = await cartModuleService.listCarts(
    { customer_id: customerId },
    { relations: ["items"], order: { updated_at: "DESC" }, take: 1 }
  )
  const customerCart = (customerCarts[0] as unknown as RawCartRow | undefined) ?? null

  if (!guestCartId) {
    return customerCart?.id ?? null
  }

  const guestCarts = await cartModuleService.listCarts(
    { id: guestCartId },
    { relations: ["items"], take: 1 }
  )
  const guestCart = guestCarts[0] as unknown as RawCartRow | undefined
  if (!guestCart) {
    return customerCart?.id ?? null
  }

  if (guestCart.customer_id && guestCart.customer_id !== customerId) {
    return customerCart?.id ?? null
  }

  if (guestCart.customer_id === customerId) {
    return customerCart?.id ?? guestCart.id
  }

  if (!customerCart) {
    await cartModuleService.updateCarts(guestCart.id, { customer_id: customerId })
    return guestCart.id
  }

  const businessConfigModuleService: BusinessConfigModuleService = container.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const cartConfig = await businessConfigModuleService.getCategoryValues("cart")
  const maxQuantityPerLineItem = Number(cartConfig.max_quantity_per_line_item ?? 10)

  for (const guestItem of guestCart.items) {
    if (!guestItem.variant_id) {
      continue
    }
    const resolved = await resolveCartVariant(container, guestItem.variant_id)
    if (!resolved) {
      continue
    }

    const existingItem = customerCart.items.find((item) => item.variant_id === resolved.variantId)
    const requestedQuantity = (existingItem?.quantity ?? 0) + guestItem.quantity
    const cappedQuantity = Math.min(
      requestedQuantity,
      resolved.availableQuantity,
      maxQuantityPerLineItem
    )
    if (cappedQuantity <= 0) {
      continue
    }

    if (existingItem) {
      await cartModuleService.updateLineItems(existingItem.id, {
        quantity: cappedQuantity,
        unit_price: resolved.unitPriceCents ?? existingItem.unit_price,
      })
    } else {
      await cartModuleService.addLineItems(customerCart.id, [
        {
          title: resolved.title,
          thumbnail: resolved.thumbnail ?? undefined,
          product_id: resolved.productId,
          variant_id: resolved.variantId,
          quantity: cappedQuantity,
          unit_price: resolved.unitPriceCents ?? 0,
          metadata: {
            vendor_id: resolved.vendorId,
            color: resolved.color,
            size: resolved.size,
          },
        },
      ])
    }
  }

  const guestItemIds = guestCart.items.map((item) => item.id)
  if (guestItemIds.length) {
    await cartModuleService.deleteLineItems(guestItemIds)
  }
  // Claim the now-empty guest cart under the customer so a repeated merge
  // call for the same guest_cart_id short-circuits above as already-merged.
  await cartModuleService.updateCarts(guestCart.id, { customer_id: customerId })

  return customerCart.id
}
