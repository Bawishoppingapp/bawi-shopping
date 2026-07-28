import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import {
  ACTIVATION_TOKEN_TTL_MS,
  generateActivationToken,
} from "../modules/seller-application/utils"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * A seller owner invites a co-worker (catalog_manager|order_fulfiller|
 * analyst - never a second "owner" from this flow, see the route). Reuses
 * the exact same activation-token pattern as seller-application approval
 * and courier provisioning - the new seller_user activates via the
 * existing generic `/seller-activation/complete` route, unchanged.
 */

type SellerStaffRole = "catalog_manager" | "order_fulfiller" | "analyst"

type CreateStaffSellerUserInput = { sellerId: string; email: string; role: SellerStaffRole }

const createStaffSellerUserStep = createStep(
  "create-staff-seller-user",
  async (input: CreateStaffSellerUserInput, { container }) => {
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    const sellerUser = await sellerModuleService.createSellerUsers({
      seller_id: input.sellerId,
      email: input.email,
      role: input.role,
      activation_token: generateActivationToken(),
      activation_token_expires_at: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
    })
    return new StepResponse(sellerUser, sellerUser.id)
  },
  async (sellerUserId, { container }) => {
    if (!sellerUserId) {
      return
    }
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellerModuleService.deleteSellerUsers([sellerUserId])
  }
)

type RecordInviteAuditLogInput = {
  sellerId: string
  sellerUserId: string
  invitedByUserId: string
  email: string
  role: SellerStaffRole
}

const recordStaffInvitedAuditLogStep = createStep(
  "record-staff-invited-audit-log",
  async (input: RecordInviteAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "seller_user",
      actorId: input.invitedByUserId,
      action: "seller_user.invited",
      entityType: "seller_user",
      entityId: input.sellerUserId,
      vendorId: input.sellerId,
      afterState: { email: input.email, role: input.role },
    })
    return new StepResponse(auditLog)
  }
)

export type InviteSellerStaffWorkflowInput = {
  sellerId: string
  email: string
  role: SellerStaffRole
  invitedByUserId: string
}

export const inviteSellerStaffWorkflowId = "invite-seller-staff"

export const inviteSellerStaffWorkflow = createWorkflow(
  inviteSellerStaffWorkflowId,
  (input: InviteSellerStaffWorkflowInput) => {
    const sellerUser = createStaffSellerUserStep({
      sellerId: input.sellerId,
      email: input.email,
      role: input.role,
    })

    recordStaffInvitedAuditLogStep({
      sellerId: input.sellerId,
      sellerUserId: sellerUser.id,
      invitedByUserId: input.invitedByUserId,
      email: input.email,
      role: input.role,
    })

    return new WorkflowResponse(sellerUser)
  }
)
