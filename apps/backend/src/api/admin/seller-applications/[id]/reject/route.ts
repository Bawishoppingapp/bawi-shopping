import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../../../../modules/seller-application"
import type SellerApplicationModuleService from "../../../../../modules/seller-application/service"
import { isValidTransition } from "../../../../../modules/seller-application/state-machine"
import { rejectApplicationSchema } from "../../../../../modules/seller-application/schemas"
import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"

/**
 * Admin-only (see middlewares.ts). The rejection reason is stored on the
 * application (private - never returned from a public endpoint, see
 * docs/SECURITY.md) and recorded in the audit log for accountability.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const parsed = rejectApplicationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const sellerApplicationModuleService: SellerApplicationModuleService =
    req.scope.resolve(SELLER_APPLICATION_MODULE)
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

  if (application.status === "rejected") {
    // Idempotent no-op - already rejected, nothing changed on this call.
    res.json({ application, already_rejected: true })
    return
  }

  if (!isValidTransition(application.status, "rejected")) {
    res.status(422).json({
      message: `Cannot reject an application with status "${application.status}"`,
    })
    return
  }

  const previousStatus = application.status
  const adminUserId = req.auth_context.actor_id

  const updated = await sellerApplicationModuleService.updateSellerApplications({
    id: application.id,
    status: "rejected",
    rejection_reason: parsed.data.reason,
    reviewed_by: adminUserId,
    reviewed_at: new Date(),
  })

  await auditLogModuleService.record({
    actorType: "user",
    actorId: adminUserId,
    action: "seller_application.rejected",
    entityType: "seller_application",
    entityId: application.id,
    beforeState: { status: previousStatus },
    afterState: { status: "rejected", rejection_reason: parsed.data.reason },
  })

  res.json({ application: updated })
}
