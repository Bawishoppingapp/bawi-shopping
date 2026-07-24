import { model } from "@medusajs/framework/utils"

/**
 * Append-only by convention (see docs/SECURITY.md #6): application code
 * never issues an UPDATE or DELETE against this table. DB-level grant
 * restrictions (revoking UPDATE/DELETE for the app's DB role) are noted
 * there as a future hardening step, not yet applied.
 */
export const AuditLog = model.define("audit_log", {
  id: model.id().primaryKey(),
  actor_type: model.enum(["customer", "seller_user", "user", "system"]),
  actor_id: model.text().nullable(),
  action: model.text(),
  entity_type: model.text(),
  entity_id: model.text(),
  vendor_id: model.text().nullable(),
  before_state: model.json().nullable(),
  after_state: model.json().nullable(),
  ip_address: model.text().nullable(),
})
