import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../../../../modules/seller-application"
import type SellerApplicationModuleService from "../../../../../modules/seller-application/service"
import { isValidTransition } from "../../../../../modules/seller-application/state-machine"
import {
  ACTIVATION_TOKEN_TTL_MS,
  generateActivationToken,
  generateUniqueSlug,
} from "../../../../../modules/seller-application/utils"
import { SELLER_MODULE } from "../../../../../modules/seller"
import type SellerModuleService from "../../../../../modules/seller/service"
import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"

/**
 * Admin-only (see middlewares.ts). The admin's identity is always read from
 * req.auth_context.actor_id - the authenticated Medusa `user` id - never
 * from anything the client sends, so the audit trail can't be spoofed.
 *
 * Idempotent: if this application was already approved (seller_id set),
 * re-calling this route returns the existing seller/seller_user rather
 * than creating duplicates. This guards the realistic case (double click,
 * retried request); a true concurrent-request race is a known residual
 * risk noted in docs/DECISIONS.md pending a workflow-based rewrite.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerApplicationModuleService: SellerApplicationModuleService =
    req.scope.resolve(SELLER_APPLICATION_MODULE)
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const auditLogModuleService: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)

  let application
  try {
    application = await sellerApplicationModuleService.retrieveSellerApplication(
      req.params.id
    )
  } catch {
    res.status(404).json({ message: "Application not found" })
    return
  }

  const adminUserId = req.auth_context.actor_id

  if (application.seller_id) {
    // Already approved - idempotent no-op, no duplicate vendor/user, no
    // duplicate audit entry (nothing actually changed on this call).
    const seller = await sellerModuleService.retrieveSeller(application.seller_id)
    res.json({ application, seller, already_approved: true })
    return
  }

  if (!isValidTransition(application.status, "approved")) {
    res.status(422).json({
      message: `Cannot approve an application with status "${application.status}"`,
    })
    return
  }

  const previousStatus = application.status

  const slug = await generateUniqueSlug(application.store_name, async (candidate) => {
    const [existing] = await sellerModuleService.listSellers({ slug: candidate })
    return Boolean(existing)
  })

  const seller = await sellerModuleService.createSellers({
    name: application.store_name,
    slug,
    status: "approved",
  })

  const sellerUser = await sellerModuleService.createSellerUsers({
    seller_id: seller.id,
    email: application.business_email,
    role: "owner",
    activation_token: generateActivationToken(),
    activation_token_expires_at: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
  })

  const updated = await sellerApplicationModuleService.updateSellerApplications({
    id: application.id,
    status: "approved",
    seller_id: seller.id,
    reviewed_by: adminUserId,
    reviewed_at: new Date(),
  })

  await auditLogModuleService.record({
    actorType: "user",
    actorId: adminUserId,
    action: "seller_application.approved",
    entityType: "seller_application",
    entityId: application.id,
    vendorId: seller.id,
    beforeState: { status: previousStatus },
    afterState: { status: "approved", seller_id: seller.id },
  })

  const sellerPortalUrl = process.env.SELLER_PORTAL_URL ?? "http://localhost:3001"

  res.json({
    application: updated,
    seller,
    seller_user: { id: sellerUser.id, email: sellerUser.email },
    activation_link: `${sellerPortalUrl}/activate?token=${sellerUser.activation_token}`,
  })
}
