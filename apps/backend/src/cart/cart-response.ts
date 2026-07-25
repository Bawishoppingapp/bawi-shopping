import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { resolveCartVariant } from "./cart-catalog"
import { calculateShippingEstimate } from "./shipping-estimate"
import { BUSINESS_CONFIG_MODULE } from "../modules/business-config"
import type BusinessConfigModuleService from "../modules/business-config/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { resolvePublicBrand } from "../modules/seller/public-brand"

export interface RawCartLineItem {
  id: string
  variant_id: string | null
  title: string
  thumbnail: string | null
  quantity: number
  unit_price: number
  metadata: Record<string, unknown> | null
}

export interface RawCart {
  id: string
  currency_code: string
  updated_at: Date | string
  items: RawCartLineItem[]
}

export type CartWarningCode = "unavailable" | "quantity_exceeds_inventory" | "price_changed"

export interface CartWarning {
  line_item_id: string
  code: CartWarningCode
  message: string
}

export interface PublicCartItem {
  id: string
  variant_id: string | null
  product_code: string | null
  title: string
  thumbnail: string | null
  brand: string | null
  color: string | null
  size: string | null
  quantity: number
  unit_price: number
  line_total: number
  available_quantity: number
  is_available: boolean
  max_quantity: number
}

export interface PublicCart {
  id: string
  currency_code: string
  items: PublicCartItem[]
  item_count: number
  subtotal: number
  shipping_estimate: number
  free_shipping_threshold: number
  amount_remaining_for_free_shipping: number
  qualifies_for_free_shipping: boolean
  checkout_blocked: boolean
  warnings: CartWarning[]
}

/** Shape returned when no cart exists yet for the caller - never null, so
 * storefront rendering code has one shape to handle regardless of whether
 * a cart row has actually been created server-side. */
export function emptyPublicCart(freeShippingThresholdCents = 0): PublicCart {
  return {
    id: "",
    currency_code: "usd",
    items: [],
    item_count: 0,
    subtotal: 0,
    shipping_estimate: 0,
    free_shipping_threshold: freeShippingThresholdCents,
    amount_remaining_for_free_shipping: freeShippingThresholdCents,
    qualifies_for_free_shipping: false,
    checkout_blocked: false,
    warnings: [],
  }
}

function lineItemVendorId(item: RawCartLineItem): string | undefined {
  const metadata = item.metadata ?? {}
  return typeof metadata.vendor_id === "string" ? metadata.vendor_id : undefined
}

/**
 * Re-derives current price and availability for every line item (never
 * trusts what's sitting in the DB from add-to-cart time), persists a
 * drifted price back to the line item, and shapes a response that never
 * includes vendor_id, seller id, private SKU, or any other seller-internal
 * field - only a resolved public brand string (see
 * docs/SECURITY.md §12, CLAUDE.md rule #12). Called by every cart route
 * right before responding, so "current" is always as of this request.
 */
export async function refreshAndShapeCart(
  container: MedusaContainer,
  cart: RawCart
): Promise<PublicCart> {
  const cartModuleService = container.resolve(Modules.CART)
  const businessConfigModuleService: BusinessConfigModuleService = container.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)

  const [cartConfig, shippingConfig] = await Promise.all([
    businessConfigModuleService.getCategoryValues("cart"),
    businessConfigModuleService.getCategoryValues("shipping"),
  ])
  const maxQuantityPerLineItem = Number(cartConfig.max_quantity_per_line_item ?? 10)
  const standardShippingFeeCents = Number(shippingConfig.standard_shipping_fee_cents ?? 0)
  const freeShippingThresholdCents = Number(shippingConfig.free_shipping_threshold_cents ?? 0)

  const vendorIds = Array.from(
    new Set(cart.items.map((item) => lineItemVendorId(item)).filter((id): id is string => !!id))
  )
  const sellers = vendorIds.length
    ? await sellerModuleService.listSellers(
        { id: vendorIds },
        { select: ["id", "name", "public_brand_display_approved"] }
      )
    : []
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))

  const warnings: CartWarning[] = []
  const items: PublicCartItem[] = []
  let subtotal = 0

  for (const item of cart.items) {
    const metadata = item.metadata ?? {}
    const fallbackColor = typeof metadata.color === "string" ? metadata.color : null
    const fallbackSize = typeof metadata.size === "string" ? metadata.size : null

    const resolved = item.variant_id
      ? await resolveCartVariant(container, item.variant_id)
      : null

    if (!resolved) {
      warnings.push({
        line_item_id: item.id,
        code: "unavailable",
        message: "This item is no longer available.",
      })
      items.push({
        id: item.id,
        variant_id: item.variant_id,
        product_code: null,
        title: item.title,
        thumbnail: item.thumbnail,
        brand: null,
        color: fallbackColor,
        size: fallbackSize,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: 0,
        available_quantity: 0,
        is_available: false,
        max_quantity: maxQuantityPerLineItem,
      })
      continue
    }

    if (resolved.unitPriceCents !== null && resolved.unitPriceCents !== item.unit_price) {
      await cartModuleService.updateLineItems(item.id, { unit_price: resolved.unitPriceCents })
      warnings.push({
        line_item_id: item.id,
        code: "price_changed",
        message: "The price of this item has changed since it was added to your cart.",
      })
    }
    const currentUnitPrice = resolved.unitPriceCents ?? item.unit_price

    const isAvailable = resolved.availableQuantity > 0
    if (item.quantity > resolved.availableQuantity) {
      warnings.push({
        line_item_id: item.id,
        code: "quantity_exceeds_inventory",
        message: "Only a limited quantity is available - please adjust the quantity to continue.",
      })
    }

    const seller = sellerById.get(resolved.vendorId)

    items.push({
      id: item.id,
      variant_id: resolved.variantId,
      product_code: resolved.productCode,
      title: resolved.title || item.title,
      thumbnail: resolved.thumbnail ?? item.thumbnail,
      brand: seller ? resolvePublicBrand(seller) : null,
      color: resolved.color ?? fallbackColor,
      size: resolved.size ?? fallbackSize,
      quantity: item.quantity,
      unit_price: currentUnitPrice,
      line_total: currentUnitPrice * item.quantity,
      available_quantity: resolved.availableQuantity,
      is_available: isAvailable,
      max_quantity: maxQuantityPerLineItem,
    })

    if (isAvailable && item.quantity <= resolved.availableQuantity) {
      subtotal += currentUnitPrice * item.quantity
    }
  }

  const checkoutBlocked = warnings.some(
    (warning) => warning.code === "unavailable" || warning.code === "quantity_exceeds_inventory"
  )

  const shippingEstimate = calculateShippingEstimate(
    subtotal,
    standardShippingFeeCents,
    freeShippingThresholdCents
  )

  return {
    id: cart.id,
    currency_code: cart.currency_code,
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shipping_estimate: shippingEstimate.shipping_estimate,
    free_shipping_threshold: freeShippingThresholdCents,
    amount_remaining_for_free_shipping: shippingEstimate.amount_remaining_for_free_shipping,
    qualifies_for_free_shipping: shippingEstimate.qualifies_for_free_shipping,
    checkout_blocked: checkoutBlocked,
    warnings,
  }
}
