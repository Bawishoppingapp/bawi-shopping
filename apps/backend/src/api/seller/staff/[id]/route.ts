import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../modules/audit-log/service"
import { resolveVendorId } from "../../../seller/utils"

/** Owner-only removal. The owner account itself can never be removed
 * through this route (a seller must always have exactly one owner) -
 * ownership transfer, if ever needed, is a separate, deliberate action,
 * not an incidental side effect of staff management. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const requestingUser = await sellerModuleService.retrieveSellerUser(req.auth_context.actor_id)
  if (requestingUser.role !== "owner") {
    res.status(403).json({ message: "Only the seller owner can remove staff" })
    return
  }

  const target = await sellerModuleService.retrieveSellerUser(req.params.id).catch(() => null)
  if (!target || target.seller_id !== vendorId) {
    res.status(404).json({ message: "Staff member not found" })
    return
  }
  if (target.role === "owner") {
    res.status(422).json({ message: "The seller owner cannot be removed" })
    return
  }

  await sellerModuleService.deleteSellerUsers([target.id])

  const auditLogModuleService: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await auditLogModuleService.record({
    actorType: "seller_user",
    actorId: requestingUser.id,
    action: "seller_user.removed",
    entityType: "seller_user",
    entityId: target.id,
    vendorId,
    beforeState: { email: target.email, role: target.role },
  })

  res.json({ success: true })
}
