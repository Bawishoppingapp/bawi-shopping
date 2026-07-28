import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { SELLER_APPLICATION_MODULE } from "../modules/seller-application"
import type SellerApplicationModuleService from "../modules/seller-application/service"
import type { SellerApplicationStatus } from "../modules/seller-application/state-machine"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { recordNotification } from "../notifications/record-notification"
import { sellerApplicationRejectedTemplate } from "../notifications/templates"

/**
 * Same atomicity concern as approve-seller-application.ts, on a smaller
 * scale: the application update and its audit-log entry must both land or
 * neither does, so a rejection is never recorded without a corresponding
 * audit trail entry (or vice versa).
 */

type MarkApplicationRejectedInput = {
  applicationId: string
  reason: string
  adminUserId: string
  previousStatus: SellerApplicationStatus
}

const markApplicationRejectedStep = createStep(
  "mark-application-rejected",
  async (input: MarkApplicationRejectedInput, { container }) => {
    const sellerApplicationModuleService: SellerApplicationModuleService = container.resolve(
      SELLER_APPLICATION_MODULE
    )
    const application = await sellerApplicationModuleService.updateSellerApplications({
      id: input.applicationId,
      status: "rejected",
      rejection_reason: input.reason,
      reviewed_by: input.adminUserId,
      reviewed_at: new Date(),
    })
    return new StepResponse(application, {
      applicationId: input.applicationId,
      previousStatus: input.previousStatus,
    })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const sellerApplicationModuleService: SellerApplicationModuleService = container.resolve(
      SELLER_APPLICATION_MODULE
    )
    await sellerApplicationModuleService.updateSellerApplications({
      id: compensationInput.applicationId,
      status: compensationInput.previousStatus,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

type RecordRejectionAuditLogInput = {
  adminUserId: string
  applicationId: string
  reason: string
  previousStatus: SellerApplicationStatus
}

const recordRejectionAuditLogStep = createStep(
  "record-rejection-audit-log",
  async (input: RecordRejectionAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "seller_application.rejected",
      entityType: "seller_application",
      entityId: input.applicationId,
      beforeState: { status: input.previousStatus },
      afterState: { status: "rejected", rejection_reason: input.reason },
    })
    // No compensation: last step in the workflow, nothing after it to fail.
    return new StepResponse(auditLog)
  }
)

const sendApplicationRejectedNotificationStep = createStep(
  "send-application-rejected-notification",
  async (input: { applicationId: string }, { container }) => {
    const sellerApplicationModuleService: SellerApplicationModuleService = container.resolve(
      SELLER_APPLICATION_MODULE
    )
    const application = await sellerApplicationModuleService.retrieveSellerApplication(
      input.applicationId
    )

    const { subject, body } = sellerApplicationRejectedTemplate()
    // No recipientType/recipientId: a rejected application never creates a
    // seller_user, so there's no in-app account to index this against -
    // see src/notifications/record-notification.ts.
    await recordNotification(container, {
      idempotencyKey: `seller_application_rejected:${input.applicationId}`,
      eventType: "seller_application_rejected",
      to: application.business_email,
      subject,
      body,
      resourceId: input.applicationId,
      resourceType: "seller_application",
    })
    return new StepResponse(null)
  }
)

export type RejectSellerApplicationWorkflowInput = {
  applicationId: string
  reason: string
  adminUserId: string
  previousStatus: SellerApplicationStatus
}

export const rejectSellerApplicationWorkflowId = "reject-seller-application"

export const rejectSellerApplicationWorkflow = createWorkflow(
  rejectSellerApplicationWorkflowId,
  (input: RejectSellerApplicationWorkflowInput) => {
    const application = markApplicationRejectedStep({
      applicationId: input.applicationId,
      reason: input.reason,
      adminUserId: input.adminUserId,
      previousStatus: input.previousStatus,
    })

    recordRejectionAuditLogStep({
      adminUserId: input.adminUserId,
      applicationId: input.applicationId,
      reason: input.reason,
      previousStatus: input.previousStatus,
    })

    sendApplicationRejectedNotificationStep({ applicationId: input.applicationId })

    return new WorkflowResponse({ application })
  }
)
