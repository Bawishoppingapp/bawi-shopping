import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

export type ClearCartInput = {
  lineItemIds: string[]
}

// No compensation, same reasoning as remove-cart-item.ts.
const clearCartItemsStep = createStep(
  "clear-cart-items",
  async (input: ClearCartInput, { container }) => {
    const cartModuleService = container.resolve(Modules.CART)
    if (input.lineItemIds.length) {
      await cartModuleService.deleteLineItems(input.lineItemIds)
    }
    return new StepResponse({ removed: input.lineItemIds.length })
  }
)

export const clearCartWorkflow = createWorkflow("clear-cart", (input: ClearCartInput) => {
  const result = clearCartItemsStep(input)
  return new WorkflowResponse(result)
})
