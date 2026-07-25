import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { resolveVendorId } from "../utils"
import { PRODUCT_LISTING_MODULE } from "../../../modules/product-listing"
import type ProductListingModuleService from "../../../modules/product-listing/service"
import { productDraftSchema } from "../../../modules/product-listing/schemas"
import { generateUniqueProductCode } from "../../../modules/product-listing/utils"
import { createProductDraftWorkflow } from "../../../workflows/create-product-draft"
import { getOrCreateDefaultStockLocationId } from "../../../workflows/shared/default-stock-location"

/**
 * A seller's own products, scoped to their vendor id (never a client-
 * supplied id - see docs/SECURITY.md §2). Draft creation runs through
 * createProductDraftWorkflow so the native Medusa product/variant/
 * inventory writes and our product_listing row are all-or-nothing.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = productDraftSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )

  const productCode = await generateUniqueProductCode(async (candidate) => {
    const [existing] = await productListingModuleService.listProductListings({
      product_code: candidate,
    })
    return Boolean(existing)
  })

  const stockLocationId = await getOrCreateDefaultStockLocationId(req.scope)

  const { result } = await createProductDraftWorkflow(req.scope).run({
    input: {
      vendorId,
      title: parsed.data.title,
      description: parsed.data.description,
      categoryId: parsed.data.category_id,
      basePrice: parsed.data.base_price,
      variants: parsed.data.variants,
      stockLocationId,
      productCode,
    },
  })

  res.status(201).json({
    product: result.product,
    listing: result.listing,
  })
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )
  const productModuleService = req.scope.resolve(Modules.PRODUCT)

  const listings = await productListingModuleService.listProductListings(
    { vendor_id: vendorId },
    { order: { created_at: "DESC" } }
  )

  if (!listings.length) {
    res.json({ products: [] })
    return
  }

  const products = await productModuleService.listProducts(
    { id: listings.map((listing) => listing.product_id) },
    { select: ["id", "title", "thumbnail", "status"] }
  )
  const productsById = new Map(products.map((product) => [product.id, product]))

  res.json({
    products: listings.map((listing) => ({
      listing,
      product: productsById.get(listing.product_id) ?? null,
    })),
  })
}
