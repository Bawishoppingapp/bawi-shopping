import { model } from "@medusajs/framework/utils"

export const BusinessConfigEntry = model.define("business_config_entry", {
  id: model.id().primaryKey(),
  category: model.enum([
    "commission",
    "transfer_timing",
    "returns",
    "shipping",
    "preparation",
    "cancellation",
    "service_area",
    "brand_visibility",
    "payment_methods",
    "tax",
    "courier",
    "email",
    "sms",
    "support",
    "cart",
    "feature_flag",
  ]),
  key: model.text(),
  // Always JSON-encoded regardless of value_type, so one column holds every
  // shape (integer, boolean, string, or a structured object) without a
  // sparse multi-column schema.
  value: model.json(),
  value_type: model.enum(["integer", "boolean", "string", "json"]),
  label: model.text(),
  description: model.text().nullable(),
  // True for a seeded development/staging value standing in for a real,
  // still-pending business/legal/operational decision - see
  // docs/DECISIONS.md. The production-readiness check reports every row
  // still at is_placeholder: true.
  is_placeholder: model.boolean().default(false),
  is_sensitive: model.boolean().default(false),
  // Medusa `user.id` of whoever last changed this value - always derived
  // server-side from req.auth_context, never client input.
  updated_by: model.text().nullable(),
})
