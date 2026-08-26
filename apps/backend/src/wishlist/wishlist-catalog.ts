import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { ProductSearchHit } from "@bawi/search-contract"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { resolvePublicBrand } from "../modules/seller/public-brand"

type VariantAgg = { available: number; prices: number[]; currencyCode: string | null }

/**
 * Batched resolution of saved product_codes into display-ready
 * ProductSearchHit rows - same shape (and the same batching technique:
 * one listProductListings IN-query, one query.graph call) the search
 * service already uses for its own listing grid, so the mobile client's
 * existing ProductHit/toProductCardData/ProductCard chain needs no new
 * mapping code. A product_code with no approved listing (delisted or
 * never existed) is simply absent from the returned map, not an error -
 * same convention as resolveCartVariants().
 */
export async function resolveWishlistHits(
  container: MedusaContainer,
  productCodes: string[]
): Promise<Map<string, ProductSearchHit>> {
  const uniqueCodes = Array.from(new Set(productCodes))
  if (!uniqueCodes.length) {
    return new Map()
  }

  const productListingModuleService: ProductListingModuleService =
    container.resolve(PRODUCT_LISTING_MODULE)
  const listings = await productListingModuleService.listProductListings({
    product_code: uniqueCodes,
    status: "approved",
  })
  if (!listings.length) {
    return new Map()
  }

  const listingByProductId = new Map(listings.map((listing) => [listing.product_id, listing]))

  const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
  const sellers = await sellerModuleService.listSellers({
    id: listings.map((listing) => listing.vendor_id),
  })
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))

  const productModuleService = container.resolve(Modules.PRODUCT)
  const products = await productModuleService.listProducts(
    { id: Array.from(listingByProductId.keys()) },
    { relations: ["categories", "variants"] }
  )

  const queryEngine = container.resolve(ContainerRegistrationKeys.QUERY)
  const variantIds = products.flatMap((product) => product.variants?.map((v) => v.id) ?? [])
  const variantData = variantIds.length
    ? (
        await queryEngine.graph({
          entity: "product_variant",
          fields: [
            "id",
            "product_id",
            "inventory_items.inventory.location_levels.available_quantity",
            "prices.amount",
            "prices.currency_code",
          ],
          filters: { id: variantIds },
        })
      ).data
    : []

  const variantAggByProductId = new Map<string, VariantAgg>()
  for (const variant of variantData as Record<string, unknown>[]) {
    const productId = variant.product_id as string
    const items = (variant.inventory_items ?? []) as Array<{
      inventory?: { location_levels?: Array<{ available_quantity?: number }> }
    }>
    const available = items.reduce((sum, item) => {
      const levels = item.inventory?.location_levels ?? []
      return sum + levels.reduce((s, l) => s + (l.available_quantity ?? 0), 0)
    }, 0)
    const listing = listingByProductId.get(productId)
    const seller = listing ? sellerById.get(listing.vendor_id) : undefined
    const prices = (variant.prices ?? []) as Array<{ amount: number; currency_code: string }>
    const price = seller ? prices.find((p) => p.currency_code === seller.currency_code) : undefined

    const agg = variantAggByProductId.get(productId) ?? { available: 0, prices: [], currencyCode: null }
    agg.available += available
    if (price !== undefined) {
      agg.prices.push(price.amount)
      agg.currencyCode = seller!.currency_code
    }
    variantAggByProductId.set(productId, agg)
  }

  const result = new Map<string, ProductSearchHit>()
  for (const product of products) {
    const listing = listingByProductId.get(product.id)
    if (!listing) {
      continue
    }
    const seller = sellerById.get(listing.vendor_id)
    if (!seller) {
      continue
    }

    const agg = variantAggByProductId.get(product.id) ?? { available: 0, prices: [], currencyCode: null }
    const priceMin = agg.prices.length ? Math.min(...agg.prices) : null
    const priceMax = agg.prices.length ? Math.max(...agg.prices) : null

    result.set(listing.product_code, {
      productCode: listing.product_code,
      title: product.title,
      brand: resolvePublicBrand(seller),
      thumbnail: product.thumbnail ?? null,
      priceMin,
      priceMax,
      currencyCode: agg.currencyCode,
      available: agg.available > 0,
      categoryIds: product.categories?.map((c) => c.id) ?? [],
    })
  }
  return result
}
