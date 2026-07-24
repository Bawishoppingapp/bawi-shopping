import { MedusaService } from "@medusajs/framework/utils"
import { AuditLog } from "./models/audit-log"

class AuditLogModuleService extends MedusaService({
  AuditLog,
}) {
  /**
   * The one way anything in the codebase writes an audit entry - keeps the
   * shape consistent (see docs/DATABASE.md's audit_log table) rather than
   * leaving each caller to assemble the record by hand.
   */
  async record(entry: {
    actorType: "customer" | "seller_user" | "user" | "system"
    actorId: string | null
    action: string
    entityType: string
    entityId: string
    vendorId?: string | null
    beforeState?: Record<string, unknown> | null
    afterState?: Record<string, unknown> | null
    ipAddress?: string | null
  }) {
    return this.createAuditLogs({
      actor_type: entry.actorType,
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      vendor_id: entry.vendorId ?? null,
      before_state: entry.beforeState ?? null,
      after_state: entry.afterState ?? null,
      ip_address: entry.ipAddress ?? null,
    })
  }
}

export default AuditLogModuleService
