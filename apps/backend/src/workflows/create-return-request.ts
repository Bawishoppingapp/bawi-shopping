import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"

/** Validation (window/status/ownership/duplicate-request checks) happens
 * in the route before this workflow runs - see docs/MARKETPLACE-FLOWS.md
 * §4 edge cases - so every call here creates a genuinely new request. */

type CreateReturnRequestInput = {
  vendorOrderItemId: string
  vendorOrderId: string
  vendorId: string
  orderId: string
  customerId: string
  reason: "damaged" | "defective" | "incorrect" | "customer_remorse"
  customerComment: string | null
}

const createReturnRequestStep = createStep(
  "create-return-request",
  async (input: CreateReturnRequestInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const returnRequest = await sellerFinanceModuleService.createReturnRequests({
      vendor_order_item_id: input.vendorOrderItemId,
      vendor_order_id: input.vendorOrderId,
      vendor_id: input.vendorId,
      order_id: input.orderId,
      customer_id: input.customerId,
      reason: input.reason,
      customer_comment: input.customerComment,
      status: "requested",
    })
    return new StepResponse(returnRequest, returnRequest.id)
  },
  async (returnRequestId, { container }) => {
    if (!returnRequestId) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    await sellerFinanceModuleService.deleteReturnRequests([returnRequestId])
  }
)

const recordReturnRequestedAuditLogStep = createStep(
  "record-return-requested-audit-log",
  async (input: { returnRequestId: string; customerId: string }, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "customer",
      actorId: input.customerId,
      action: "return_request.requested",
      entityType: "return_request",
      entityId: input.returnRequestId,
    })
    return new StepResponse(auditLog)
  }
)

export type CreateReturnRequestWorkflowInput = CreateReturnRequestInput

export const createReturnRequestWorkflowId = "create-return-request"

export const createReturnRequestWorkflow = createWorkflow(
  createReturnRequestWorkflowId,
  (input: CreateReturnRequestWorkflowInput) => {
    const returnRequest = createReturnRequestStep(input)
    recordReturnRequestedAuditLogStep({
      returnRequestId: returnRequest.id,
      customerId: input.customerId,
    })
    return new WorkflowResponse(returnRequest)
  }
)
