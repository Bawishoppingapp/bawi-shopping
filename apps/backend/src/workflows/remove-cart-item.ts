import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

export type RemoveLineItemInput = {
  lineItemId: string
}

// No compensation: Medusa's generated line-item CRUD soft-deletes but
// doesn't expose a restore method, and there is nothing after this single
// step that could fail and need a rollback.
const removeLineItemStep = createStep(
  "remove-line-item",
  async (input: RemoveLineItemInput, { container }) => {
    const cartModuleService = container.resolve(Modules.CART)
    await cartModuleService.deleteLineItems(input.lineItemId)
    return new StepResponse({ lineItemId: input.lineItemId })
  }
)

export const removeCartItemWorkflow = createWorkflow(
  "remove-cart-item",
  (input: RemoveLineItemInput) => {
    const result = removeLineItemStep(input)
    return new WorkflowResponse(result)
  }
)
