import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { resolveVendorId } from "../../utils"
import { PRODUCT_LISTING_MODULE } from "../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../modules/product-listing/service"
import { productDraftSchema } from "../../../../modules/product-listing/schemas"
import { updateProductDraftWorkflow } from "../../../../workflows/update-product-draft"
import { getOrCreateDefaultStockLocationId } from "../../../../workflows/shared/default-stock-location"

/**
 * A seller can only ever fetch/edit their own product listing - a listing
 * owned by another vendor id is treated as not found, not forbidden, so a
 * seller can't distinguish "doesn't exist" from "exists but isn't mine"
 * (see docs/SECURITY.md §2 and the mandatory negative-authz test).
 */
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

  const [listing] = await productListingModuleService.listProductListings({
    id: req.params.id,
    vendor_id: vendorId,
  })

  if (!listing) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const product = await productModuleService.retrieveProduct(listing.product_id, {
    relations: ["variants", "variants.options", "options", "options.values", "images", "categories"],
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variantData } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "inventory_items.inventory.location_levels.stocked_quantity",
      "prices.amount",
      "prices.currency_code",
    ],
    filters: { id: product.variants?.map((v) => v.id) ?? [] },
  })

  const inventoryByVariantId = new Map<string, number>()
  const priceByVariantId = new Map<string, number>()
  for (const variant of variantData as Record<string, unknown>[]) {
    const items = (variant.inventory_items ?? []) as Array<{
      inventory?: { location_levels?: Array<{ stocked_quantity?: number }> }
    }>
    const stocked = items.reduce((sum, item) => {
      const levels = item.inventory?.location_levels ?? []
      return sum + levels.reduce((s, l) => s + (l.stocked_quantity ?? 0), 0)
    }, 0)
    inventoryByVariantId.set(variant.id as string, stocked)

    const prices = (variant.prices ?? []) as Array<{ amount: number; currency_code: string }>
    const usdPrice = prices.find((price) => price.currency_code === "usd")
    if (usdPrice) {
      priceByVariantId.set(variant.id as string, usdPrice.amount)
    }
  }

  res.json({
    listing,
    product: {
      ...product,
      variants: product.variants?.map((variant) => ({
        ...variant,
        inventory_quantity: inventoryByVariantId.get(variant.id) ?? 0,
        price: priceByVariantId.get(variant.id) ?? null,
      })),
    },
  })
}

/** Editable only while the listing is `draft` or `rejected` (see state-machine.ts). */
export async function PUT(
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

  const [listing] = await productListingModuleService.listProductListings({
    id: req.params.id,
    vendor_id: vendorId,
  })

  if (!listing) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  if (listing.status !== "draft" && listing.status !== "rejected") {
    res.status(422).json({
      message: `Cannot edit a product with status "${listing.status}"`,
    })
    return
  }

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const existingProduct = await productModuleService.retrieveProduct(listing.product_id, {
    relations: ["options", "options.values"],
  })
  const existingColors = new Set(
    existingProduct.options?.find((o) => o.title === "Color")?.values?.map((v) => v.value) ?? []
  )
  const existingSizes = new Set(
    existingProduct.options?.find((o) => o.title === "Size")?.values?.map((v) => v.value) ?? []
  )
  const introducesNewValue = parsed.data.variants.some(
    (variant) => !existingColors.has(variant.color) || !existingSizes.has(variant.size)
  )
  if (introducesNewValue) {
    res.status(422).json({
      message:
        "Editing can't introduce a new color or size that wasn't part of the product at creation - create a new product for that instead.",
    })
    return
  }

  const stockLocationId = await getOrCreateDefaultStockLocationId(req.scope)

  const { result } = await updateProductDraftWorkflow(req.scope).run({
    input: {
      productId: listing.product_id,
      listingId: listing.id,
      wasRejected: listing.status === "rejected",
      title: parsed.data.title,
      description: parsed.data.description,
      categoryId: parsed.data.category_id,
      basePrice: parsed.data.base_price,
      variants: parsed.data.variants,
      stockLocationId,
      productCode: listing.product_code,
    },
  })

  res.json({ listing: result.listing })
}
