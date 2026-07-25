import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

export type UpdateLineItemQuantityInput = {
  lineItemId: string
  quantity: number
  previousQuantity: number
}

const updateLineItemQuantityStep = createStep(
  "update-line-item-quantity",
  async (input: UpdateLineItemQuantityInput, { container }) => {
    const cartModuleService = container.resolve(Modules.CART)
    await cartModuleService.updateLineItems(input.lineItemId, { quantity: input.quantity })
    return new StepResponse(
      { lineItemId: input.lineItemId },
      { lineItemId: input.lineItemId, previousQuantity: input.previousQuantity }
    )
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const cartModuleService = container.resolve(Modules.CART)
    await cartModuleService.updateLineItems(compensationInput.lineItemId, {
      quantity: compensationInput.previousQuantity,
    })
  }
)

export const updateCartItemQuantityWorkflow = createWorkflow(
  "update-cart-item-quantity",
  (input: UpdateLineItemQuantityInput) => {
    const result = updateLineItemQuantityStep(input)
    return new WorkflowResponse(result)
  }
)
