import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { FULFILLMENT_PRIVACY_MODULE } from "../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../modules/fulfillment-privacy/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import {
  ACTIVATION_TOKEN_TTL_MS,
  generateActivationToken,
} from "../modules/seller-application/utils"

/**
 * Admin provisions a courier account directly (couriers are Bawi
 * contractors/employees, not self-service applicants like sellers - see
 * docs/DECISIONS.md), reusing the exact same activation-token pattern as
 * seller_user since no notification service exists yet to email the link
 * (same deferral as seller-application approval).
 */

type CreateCourierInput = { name: string; email: string; phone: string | null }

const createCourierStep = createStep(
  "create-courier",
  async (input: CreateCourierInput, { container }) => {
    const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
      FULFILLMENT_PRIVACY_MODULE
    )
    const courier = await fulfillmentPrivacyModuleService.createCouriers({
      name: input.name,
      email: input.email,
      phone: input.phone,
      activation_token: generateActivationToken(),
      activation_token_expires_at: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
    })
    return new StepResponse(courier, courier.id)
  },
  async (courierId, { container }) => {
    if (!courierId) {
      return
    }
    const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
      FULFILLMENT_PRIVACY_MODULE
    )
    await fulfillmentPrivacyModuleService.deleteCouriers([courierId])
  }
)

type RecordAuditLogInput = { courierId: string; adminUserId: string }

const recordCourierProvisionedAuditLogStep = createStep(
  "record-courier-provisioned-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "courier.provisioned",
      entityType: "courier",
      entityId: input.courierId,
    })
    return new StepResponse(auditLog)
  }
)

export type ProvisionCourierWorkflowInput = CreateCourierInput & { adminUserId: string }

export const provisionCourierWorkflowId = "provision-courier"

export const provisionCourierWorkflow = createWorkflow(
  provisionCourierWorkflowId,
  (input: ProvisionCourierWorkflowInput) => {
    const courier = createCourierStep({ name: input.name, email: input.email, phone: input.phone })
    recordCourierProvisionedAuditLogStep({ courierId: courier.id, adminUserId: input.adminUserId })
    return new WorkflowResponse(courier)
  }
)
