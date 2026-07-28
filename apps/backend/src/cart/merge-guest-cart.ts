import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resolveCartVariants } from "./cart-catalog"
import { BUSINESS_CONFIG_MODULE } from "../modules/business-config"
import type BusinessConfigModuleService from "../modules/business-config/service"
import { CART_MERGE_MODULE } from "../modules/cart-merge"
import type CartMergeModuleService from "../modules/cart-merge/service"

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
 * Idempotent under true concurrency, not just sequential replay: before
 * touching any line item, this claims the guest cart id via
 * CartMergeModuleService.claim(), which is backed by a unique-index
 * INSERT (same pattern as WebhookEventModuleService.markProcessed - see
 * docs/DECISIONS.md). Medusa's cartModuleService.updateCarts(selector,
 * data) is a SELECT-then-UPDATE-by-id under the hood, not an atomic
 * conditional UPDATE, so it cannot be used as the concurrency guard here -
 * two simultaneous callers would both pass the "not yet claimed" read and
 * both proceed to merge, duplicating line items. The claim table's unique
 * constraint closes that race at the database level: only one concurrent
 * caller's INSERT succeeds, the other gets `false` back and returns
 * immediately without touching any cart. Quantity conflicts are resolved
 * by summing and capping to live inventory and the configurable
 * per-line-item maximum - never rejected, since a login flow shouldn't
 * fail over a stock conflict (see docs/PRD.md §9.10).
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
    // Not actually a guest cart - either never one, or already claimed by
    // a different customer entirely. Never merge it.
    return customerCart?.id ?? null
  }

  const cartMergeModuleService: CartMergeModuleService = container.resolve(CART_MERGE_MODULE)
  const claimed = await cartMergeModuleService.claim(guestCartId, customerId)
  if (!claimed) {
    // Either this exact merge already ran to completion (sequential
    // replay - idempotent no-op) or a concurrent call is doing it right
    // now (true-concurrency guard - this call yields rather than racing
    // it). Either way there is nothing left for this call to do.
    return customerCart?.id ?? (guestCart.customer_id === customerId ? guestCart.id : null)
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

  // One batched resolution for every guest line item's variant instead of
  // 2N sequential round-trips - see resolveCartVariants()'s docs.
  const guestVariantIds = guestCart.items
    .map((item) => item.variant_id)
    .filter((id): id is string => !!id)
  const resolvedByVariantId = await resolveCartVariants(container, guestVariantIds)

  const quantityUpdates: Array<{ id: string; quantity: number; unit_price: number }> = []
  const newLineItems: Array<{
    title: string
    thumbnail?: string
    product_id: string
    variant_id: string
    quantity: number
    unit_price: number
    metadata: Record<string, unknown>
  }> = []

  for (const guestItem of guestCart.items) {
    if (!guestItem.variant_id) {
      continue
    }
    const resolved = resolvedByVariantId.get(guestItem.variant_id)
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
      quantityUpdates.push({
        id: existingItem.id,
        quantity: cappedQuantity,
        unit_price: resolved.unitPriceCents ?? existingItem.unit_price,
      })
    } else {
      newLineItems.push({
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
      })
    }
  }

  if (quantityUpdates.length) {
    await cartModuleService.updateLineItems(quantityUpdates)
  }
  if (newLineItems.length) {
    await cartModuleService.addLineItems(customerCart.id, newLineItems)
  }

  const guestItemIds = guestCart.items.map((item) => item.id)
  if (guestItemIds.length) {
    await cartModuleService.deleteLineItems(guestItemIds)
  }
  // Deliberately NOT attributing the now-empty guest cart to the customer
  // here (unlike the promote-in-place branch above): findActiveCart()
  // picks a customer's cart by "most recently updated," and this cart's
  // own updated_at would otherwise become more recent than the real
  // customerCart's (whose items were just written a moment earlier in the
  // loop above) - the very next GET /store/cart would then resolve to
  // this now-empty, defunct cart instead of the one that actually has the
  // customer's items. The cart_merge_claim row from earlier already makes
  // this guest_cart_id permanently non-reusable, so leaving customer_id
  // untouched here is safe: at worst a stale guest-cart-id cookie resolves
  // to a harmless empty cart, never to someone else's data.
  return customerCart.id
}
