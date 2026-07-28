import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { recordNotification } from "../notifications/record-notification"
import { returnStatusChangedTemplate } from "../notifications/templates"

type DenyInput = {
  returnRequestId: string
  reviewerId: string
  reviewerType: "seller_user" | "user"
  sellerResponse: string
}

const markDeniedStep = createStep(
  "mark-denied",
  async (input: DenyInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const returnRequest = await sellerFinanceModuleService.updateReturnRequests({
      id: input.returnRequestId,
      status: "denied",
      seller_response: input.sellerResponse,
      reviewed_by: input.reviewerId,
      reviewed_at: new Date(),
    })
    return new StepResponse(returnRequest, input.returnRequestId)
  },
  async (returnRequestId, { container }) => {
    if (!returnRequestId) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    await sellerFinanceModuleService.updateReturnRequests({
      id: returnRequestId,
      status: "requested",
      seller_response: null,
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

const recordDeniedAuditLogStep = createStep(
  "record-denied-audit-log",
  async (input: DenyInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: input.reviewerType,
      actorId: input.reviewerId,
      action: "return_request.denied",
      entityType: "return_request",
      entityId: input.returnRequestId,
      afterState: { status: "denied" },
    })
    return new StepResponse(auditLog)
  }
)

const sendReturnDeniedNotificationStep = createStep(
  "send-return-denied-notification",
  async (input: { returnRequestId: string }, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const customerModuleService = container.resolve(Modules.CUSTOMER)

    const returnRequest = await sellerFinanceModuleService.retrieveReturnRequest(
      input.returnRequestId
    )
    const customer = await customerModuleService.retrieveCustomer(returnRequest.customer_id)
    if (!customer.email) {
      return new StepResponse(null)
    }

    const { subject, body } = returnStatusChangedTemplate({
      status: "denied",
      reason: returnRequest.reason,
    })
    await recordNotification(container, {
      idempotencyKey: `return_status_changed:${input.returnRequestId}:denied`,
      eventType: "return_status_changed",
      to: customer.email,
      subject,
      body,
      recipientType: "customer",
      recipientId: returnRequest.customer_id,
      resourceId: input.returnRequestId,
      resourceType: "return_request",
    })
    return new StepResponse(null)
  }
)

export type DenyReturnRequestWorkflowInput = DenyInput

export const denyReturnRequestWorkflowId = "deny-return-request"

export const denyReturnRequestWorkflow = createWorkflow(
  denyReturnRequestWorkflowId,
  (input: DenyReturnRequestWorkflowInput) => {
    const returnRequest = markDeniedStep(input)
    recordDeniedAuditLogStep(input)
    sendReturnDeniedNotificationStep({ returnRequestId: input.returnRequestId })
    return new WorkflowResponse(returnRequest)
  }
)
