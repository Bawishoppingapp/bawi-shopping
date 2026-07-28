import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"

export interface CartVariantInfo {
  variantId: string
  productId: string
  vendorId: string
  productCode: string
  title: string
  thumbnail: string | null
  color: string | null
  size: string | null
  unitPriceCents: number | null
  availableQuantity: number
  // The variant's underlying inventory_item id - checkout's inventory
  // reservation step needs this (see src/orders/); null if the variant
  // has no inventory item at all (shouldn't happen for a purchasable
  // variant, but the type stays honest about it).
  inventoryItemId: string | null
}

const VARIANT_FIELDS = [
  "id",
  "product_id",
  "product.title",
  "product.thumbnail",
  "options.value",
  "options.option.title",
  "inventory_items.inventory.id",
  "inventory_items.inventory.location_levels.available_quantity",
  "prices.amount",
  "prices.currency_code",
]

function toCartVariantInfo(
  variant: Record<string, unknown>,
  vendorId: string,
  productCode: string
): CartVariantInfo {
  const inventoryItems = (variant.inventory_items ?? []) as Array<{
    inventory?: { id?: string; location_levels?: Array<{ available_quantity?: number }> }
  }>
  const availableQuantity = inventoryItems.reduce((sum, item) => {
    const levels = item.inventory?.location_levels ?? []
    return sum + levels.reduce((s, l) => s + (l.available_quantity ?? 0), 0)
  }, 0)
  const inventoryItemId = inventoryItems[0]?.inventory?.id ?? null

  const prices = (variant.prices ?? []) as Array<{ amount: number; currency_code: string }>
  const usdPrice = prices.find((price) => price.currency_code === "usd")

  const options = (variant.options ?? []) as Array<{
    value: string
    option?: { title: string }
  }>
  const color = options.find((o) => o.option?.title === "Color")?.value ?? null
  const size = options.find((o) => o.option?.title === "Size")?.value ?? null

  const product = variant.product as { title?: string; thumbnail?: string | null } | undefined

  return {
    variantId: variant.id as string,
    productId: variant.product_id as string,
    vendorId,
    productCode,
    title: product?.title ?? "",
    thumbnail: product?.thumbnail ?? null,
    color,
    size,
    unitPriceCents: usdPrice ? usdPrice.amount : null,
    availableQuantity,
    inventoryItemId,
  }
}

/**
 * Batched form of resolveCartVariant() - one query.graph call for every
 * variant id and one listProductListings call for every distinct product
 * id, instead of two round-trips per item. Every cart operation that
 * touches more than one line item at once (refreshing/shaping a whole
 * cart, merging a guest cart) must use this instead of looping
 * resolveCartVariant() per item, which would otherwise issue 2N sequential
 * round-trips for an N-item cart. A variant that doesn't exist, or whose
 * product listing isn't `approved`, is simply absent from the returned
 * map (see resolveCartVariant()'s docs for why).
 */
export async function resolveCartVariants(
  container: MedusaContainer,
  variantIds: string[]
): Promise<Map<string, CartVariantInfo>> {
  const uniqueIds = Array.from(new Set(variantIds))
  if (!uniqueIds.length) {
    return new Map()
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: VARIANT_FIELDS,
    filters: { id: uniqueIds },
  })

  const productIds = Array.from(
    new Set((variants as Record<string, unknown>[]).map((v) => v.product_id as string))
  )
  if (!productIds.length) {
    return new Map()
  }

  const productListingModuleService: ProductListingModuleService =
    container.resolve(PRODUCT_LISTING_MODULE)
  const listings = await productListingModuleService.listProductListings({
    product_id: productIds,
    status: "approved",
  })
  const listingByProductId = new Map(listings.map((listing) => [listing.product_id, listing]))

  const result = new Map<string, CartVariantInfo>()
  for (const variant of variants as Record<string, unknown>[]) {
    const listing = listingByProductId.get(variant.product_id as string)
    if (!listing) {
      continue
    }
    result.set(
      variant.id as string,
      toCartVariantInfo(variant, listing.vendor_id, listing.product_code)
    )
  }
  return result
}

/**
 * The sole source of truth for what a variant is worth, whether it's in
 * stock, and who sells it - every single-variant cart mutation resolves
 * through this instead of trusting anything the browser sent. Returns null
 * for a variant that doesn't exist or whose product listing isn't
 * `approved` (draft/pending_review/rejected/archived can never be added to
 * or remain purchasable in a cart - see docs/PRD.md §9.6). For resolving
 * every line item of an existing cart at once, use resolveCartVariants()
 * instead - looping this per item would issue 2N sequential round-trips.
 */
export async function resolveCartVariant(
  container: MedusaContainer,
  variantId: string
): Promise<CartVariantInfo | null> {
  const results = await resolveCartVariants(container, [variantId])
  return results.get(variantId) ?? null
}
