import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryItemsWorkflow,
  createProductVariantsWorkflow,
  deleteProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import type { CreateProductDraftVariantInput } from "./create-product-draft"

/**
 * Editing a draft (or previously-rejected) product's variants replaces the
 * whole variant set rather than diffing add/remove/update - simpler to get
 * right and safe here specifically because a draft/rejected product has
 * never been published, so nothing (no order, no cart) can be referencing
 * its current variants yet. See docs/DECISIONS.md.
 *
 * v1 limitation (documented, not a bug): an edit can only use color/size
 * *values* that already exist on the product from creation - it can drop
 * variants, change their price/inventory, or recombine existing values, but
 * introducing a brand new color or size requires creating a new product.
 * The API route validates this before invoking the workflow (see
 * src/api/seller/products/[id]/route.ts), so the workflow itself never has
 * to create new option values - only new variants against already-existing
 * ones, which is the well-tested path.
 */

function variantSku(productCode: string, color: string, size: string): string {
  return `${productCode}-${color}-${size}`.toUpperCase().replace(/\s+/g, "-")
}

const getExistingVariantIdsStep = createStep(
  "get-existing-variant-ids",
  async (input: { productId: string }, { container }) => {
    const productModuleService = container.resolve(Modules.PRODUCT)
    const product = await productModuleService.retrieveProduct(input.productId, {
      relations: ["variants"],
    })
    return new StepResponse((product.variants ?? []).map((v) => v.id))
  }
)

type UpdateListingAfterEditInput = {
  listingId: string
  wasRejected: boolean
}

const markListingEditedStep = createStep(
  "mark-listing-edited",
  async (input: UpdateListingAfterEditInput, { container }) => {
    const productListingModuleService: ProductListingModuleService = container.resolve(
      PRODUCT_LISTING_MODULE
    )
    const listing = await productListingModuleService.updateProductListings({
      id: input.listingId,
      ...(input.wasRejected
        ? { status: "draft" as const, rejection_reason: null }
        : {}),
    })
    return new StepResponse(listing)
  }
)

export type UpdateProductDraftWorkflowInput = {
  productId: string
  listingId: string
  wasRejected: boolean
  title: string
  description: string
  categoryId: string
  basePrice: number
  variants: CreateProductDraftVariantInput[]
  stockLocationId: string
  productCode: string
  // The seller's own currency - see create-product-draft.ts's identical
  // field for why this isn't a per-product choice.
  currencyCode: string
}

export const updateProductDraftWorkflowId = "update-product-draft"

export const updateProductDraftWorkflow = createWorkflow(
  updateProductDraftWorkflowId,
  (input: UpdateProductDraftWorkflowInput) => {
    const existingVariantIds = getExistingVariantIdsStep({ productId: input.productId })

    deleteProductVariantsWorkflow.runAsStep({
      input: { ids: existingVariantIds },
    })

    const productFieldsInput = transform({ input }, (data) => ({
      products: [
        {
          id: data.input.productId,
          title: data.input.title,
          description: data.input.description,
          categories: [{ id: data.input.categoryId }],
        },
      ],
    }))

    updateProductsWorkflow.runAsStep({ input: productFieldsInput })

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

    const productVariantsInput = transform({ input, createdInventoryItems }, (data) => ({
      product_variants: data.input.variants.map((variant, index) => ({
        product_id: data.input.productId,
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

    const createdVariants = createProductVariantsWorkflow.runAsStep({
      input: productVariantsInput,
    })

    const listing = markListingEditedStep({
      listingId: input.listingId,
      wasRejected: input.wasRejected,
    })

    return new WorkflowResponse({ listing, variants: createdVariants })
  }
)
