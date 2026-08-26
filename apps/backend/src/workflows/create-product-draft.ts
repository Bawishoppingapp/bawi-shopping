import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryItemsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"

/**
 * A seller's "create product" action touches Medusa's native product module
 * (product + variants + prices + inventory items, via its own well-tested
 * workflows) and our custom product_listing module (vendor ownership +
 * approval status + permanent product code). Composing them in one workflow
 * - rather than calling each in sequence in the route handler - means a
 * failure partway through (e.g. the product_listing write fails after the
 * product was already created) rolls back everything, the same reasoning as
 * approve-seller-application.ts. Native sub-workflows keep their own
 * internal compensation when run via `.runAsStep()`, so composing them here
 * gets that rollback for free.
 */

export type CreateProductDraftVariantInput = {
  color: string
  size: string
  price?: number
  inventory_quantity: number
}

type CreateProductListingInput = {
  productId: string
  vendorId: string
  productCode: string
}

const createProductListingStep = createStep(
  "create-product-listing",
  async (input: CreateProductListingInput, { container }) => {
    const productListingModuleService: ProductListingModuleService =
      container.resolve(PRODUCT_LISTING_MODULE)
    const listing = await productListingModuleService.createProductListings({
      product_id: input.productId,
      vendor_id: input.vendorId,
      product_code: input.productCode,
      status: "draft",
    })
    return new StepResponse(listing, listing.id)
  },
  async (listingId, { container }) => {
    if (!listingId) {
      return
    }
    const productListingModuleService: ProductListingModuleService =
      container.resolve(PRODUCT_LISTING_MODULE)
    await productListingModuleService.deleteProductListings([listingId])
  }
)

export type CreateProductDraftWorkflowInput = {
  vendorId: string
  title: string
  description: string
  categoryId: string
  basePrice: number
  variants: CreateProductDraftVariantInput[]
  stockLocationId: string
  productCode: string
  // The seller's own currency (see modules/seller/models/seller.ts) -
  // every price on this product is written in it. Not a per-product
  // choice - a seller's whole catalog shares one currency.
  currencyCode: string
}

function variantSku(productCode: string, color: string, size: string): string {
  return `${productCode}-${color}-${size}`.toUpperCase().replace(/\s+/g, "-")
}

function dedupeInOrder(values: string[]): string[] {
  return Array.from(new Set(values))
}

export const createProductDraftWorkflowId = "create-product-draft"

export const createProductDraftWorkflow = createWorkflow(
  createProductDraftWorkflowId,
  (input: CreateProductDraftWorkflowInput) => {
    const inventoryItemsInput = transform({ input }, (data) =>
      data.input.variants.map((variant) => ({
        sku: variantSku(data.input.productCode, variant.color, variant.size),
        location_levels: [
          {
            location_id: data.input.stockLocationId,
            stocked_quantity: variant.inventory_quantity,
          },
        ],
      }))
    )

    const createdInventoryItems = createInventoryItemsWorkflow.runAsStep({
      input: { items: inventoryItemsInput },
    })

    const productInput = transform({ input, createdInventoryItems }, (data) => ({
      title: data.input.title,
      description: data.input.description,
      status: "draft" as const,
      categories: [{ id: data.input.categoryId }],
      options: [
        {
          title: "Color",
          values: dedupeInOrder(data.input.variants.map((v) => v.color)),
        },
        {
          title: "Size",
          values: dedupeInOrder(data.input.variants.map((v) => v.size)),
        },
      ],
      variants: data.input.variants.map((variant, index) => ({
        title: `${variant.color} / ${variant.size}`,
        sku: variantSku(data.input.productCode, variant.color, variant.size),
        manage_inventory: true,
        inventory_items: [
          { inventory_item_id: data.createdInventoryItems[index].id },
        ],
        options: { Color: variant.color, Size: variant.size },
        prices: [
          {
            amount: variant.price ?? data.input.basePrice,
            currency_code: data.input.currencyCode,
          },
        ],
      })),
    }))

    const createdProducts = createProductsWorkflow.runAsStep({
      input: { products: [productInput] },
    })

    const product = transform({ createdProducts }, (data) => data.createdProducts[0])

    const listing = createProductListingStep({
      productId: product.id,
      vendorId: input.vendorId,
      productCode: input.productCode,
    })

    return new WorkflowResponse({ product, listing })
  }
)
