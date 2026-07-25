import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../../../modules/product-listing"
import type ProductListingModuleService from "../../../modules/product-listing/service"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { resolvePublicBrand } from "../../../modules/seller/public-brand"

/**
 * Public, unauthenticated. Only ever returns an `approved` listing - draft/
 * pending_review/rejected/archived products are never visible here (see
 * docs/PRD.md §9.6). The response is explicitly shaped, not "return the row
 * and let the client filter": no vendor SKU (private, see docs/SECURITY.md
 * §11), no seller contact/PII - only the seller's public-facing name,
 * matching the "brand" a customer would see on the product page, not their
 * account/contact identity.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )

  const [listing] = await productListingModuleService.listProductListings({
    product_code: req.params.code,
    status: "approved",
  })

  if (!listing) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const product = await productModuleService.retrieveProduct(listing.product_id, {
    relations: ["variants", "variants.options", "options", "options.values", "images"],
  })

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const seller = await sellerModuleService.retrieveSeller(listing.vendor_id)

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variantData } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "inventory_items.inventory.location_levels.available_quantity",
      "prices.amount",
      "prices.currency_code",
    ],
    filters: { id: product.variants?.map((v) => v.id) ?? [] },
  })

  const availabilityByVariantId = new Map<string, number>()
  const priceByVariantId = new Map<string, number>()

  for (const variant of variantData as Record<string, unknown>[]) {
    const items = (variant.inventory_items ?? []) as Array<{
      inventory?: { location_levels?: Array<{ available_quantity?: number }> }
    }>
    const available = items.reduce((sum, item) => {
      const levels = item.inventory?.location_levels ?? []
      return sum + levels.reduce((s, l) => s + (l.available_quantity ?? 0), 0)
    }, 0)
    availabilityByVariantId.set(variant.id as string, available)

    const prices = (variant.prices ?? []) as Array<{ amount: number; currency_code: string }>
    const usdPrice = prices.find((price) => price.currency_code === "usd")
    if (usdPrice) {
      priceByVariantId.set(variant.id as string, usdPrice.amount)
    }
  }

  res.json({
    product: {
      product_code: listing.product_code,
      title: product.title,
      description: product.description,
      brand: resolvePublicBrand(seller),
      images: product.images?.map((image) => image.url) ?? [],
      thumbnail: product.thumbnail,
      colors: Array.from(
        new Set(
          product.options
            ?.find((option) => option.title === "Color")
            ?.values?.map((value) => value.value) ?? []
        )
      ),
      sizes: Array.from(
        new Set(
          product.options
            ?.find((option) => option.title === "Size")
            ?.values?.map((value) => value.value) ?? []
        )
      ),
      base_price: Math.min(...Array.from(priceByVariantId.values()), Infinity),
      variants:
        product.variants?.map((variant) => ({
          id: variant.id,
          color: variant.options?.find((o) => o.option?.title === "Color")?.value,
          size: variant.options?.find((o) => o.option?.title === "Size")?.value,
          price: priceByVariantId.get(variant.id) ?? null,
          available_quantity: availabilityByVariantId.get(variant.id) ?? 0,
        })) ?? [],
    },
  })
}
