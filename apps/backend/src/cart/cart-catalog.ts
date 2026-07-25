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
}

/**
 * The sole source of truth for what a variant is worth, whether it's in
 * stock, and who sells it - every cart mutation and refresh resolves
 * through this instead of trusting anything the browser sent. Returns null
 * for a variant that doesn't exist or whose product listing isn't
 * `approved` (draft/pending_review/rejected/archived can never be added to
 * or remain purchasable in a cart - see docs/PRD.md §9.6).
 */
export async function resolveCartVariant(
  container: MedusaContainer,
  variantId: string
): Promise<CartVariantInfo | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "product_id",
      "product.title",
      "product.thumbnail",
      "options.value",
      "options.option.title",
      "inventory_items.inventory.location_levels.available_quantity",
      "prices.amount",
      "prices.currency_code",
    ],
    filters: { id: [variantId] },
  })

  const variant = variants[0] as Record<string, unknown> | undefined
  if (!variant) {
    return null
  }

  const productId = variant.product_id as string

  const productListingModuleService: ProductListingModuleService =
    container.resolve(PRODUCT_LISTING_MODULE)
  const [listing] = await productListingModuleService.listProductListings({
    product_id: productId,
    status: "approved",
  })
  if (!listing) {
    return null
  }

  const inventoryItems = (variant.inventory_items ?? []) as Array<{
    inventory?: { location_levels?: Array<{ available_quantity?: number }> }
  }>
  const availableQuantity = inventoryItems.reduce((sum, item) => {
    const levels = item.inventory?.location_levels ?? []
    return sum + levels.reduce((s, l) => s + (l.available_quantity ?? 0), 0)
  }, 0)

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
    productId,
    vendorId: listing.vendor_id,
    productCode: listing.product_code,
    title: product?.title ?? "",
    thumbnail: product?.thumbnail ?? null,
    color,
    size,
    unitPriceCents: usdPrice ? usdPrice.amount : null,
    availableQuantity,
  }
}
