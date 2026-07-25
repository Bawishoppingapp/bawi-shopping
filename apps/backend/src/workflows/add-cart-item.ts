import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

export type AddOrIncrementLineItemInput = {
  cartId: string
  existingItemId?: string
  currentQuantity: number
  currentUnitPrice?: number
  requestedQuantity: number
  unitPrice: number
  productId: string
  variantId: string
  title: string
  thumbnail?: string
  vendorId: string
  color: string | null
  size: string | null
}

// Explicit union (not inferred) - a step's two StepResponse branches must
// share one compensation type for TS to unify them, same fix as
// EnsureStripeAccountCompensation in connect-seller-stripe-account.ts.
type AddLineItemCompensation =
  | { existed: true; lineItemId: string; previousQuantity: number; previousUnitPrice: number }
  | { existed: false; lineItemId: string }

const addOrIncrementLineItemStep = createStep(
  "add-or-increment-line-item",
  async (
    input: AddOrIncrementLineItemInput,
    { container }
  ): Promise<StepResponse<{ lineItemId: string }, AddLineItemCompensation>> => {
    const cartModuleService = container.resolve(Modules.CART)

    if (input.existingItemId) {
      await cartModuleService.updateLineItems(input.existingItemId, {
        quantity: input.requestedQuantity,
        unit_price: input.unitPrice,
      })
      const compensation: AddLineItemCompensation = {
        existed: true,
        lineItemId: input.existingItemId,
        previousQuantity: input.currentQuantity,
        previousUnitPrice: input.currentUnitPrice ?? input.unitPrice,
      }
      return new StepResponse({ lineItemId: input.existingItemId }, compensation)
    }

    const [created] = await cartModuleService.addLineItems(input.cartId, [
      {
        title: input.title,
        thumbnail: input.thumbnail,
        product_id: input.productId,
        variant_id: input.variantId,
        quantity: input.requestedQuantity,
        unit_price: input.unitPrice,
        metadata: {
          vendor_id: input.vendorId,
          color: input.color,
          size: input.size,
        },
      },
    ])
    const compensation: AddLineItemCompensation = { existed: false, lineItemId: created.id }
    return new StepResponse({ lineItemId: created.id }, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const cartModuleService = container.resolve(Modules.CART)
    if (compensationInput.existed) {
      await cartModuleService.updateLineItems(compensationInput.lineItemId, {
        quantity: compensationInput.previousQuantity,
        unit_price: compensationInput.previousUnitPrice,
      })
    } else {
      await cartModuleService.deleteLineItems(compensationInput.lineItemId)
    }
  }
)

export const addCartItemWorkflow = createWorkflow(
  "add-cart-item",
  (input: AddOrIncrementLineItemInput) => {
    const result = addOrIncrementLineItemStep(input)
    return new WorkflowResponse(result)
  }
)
