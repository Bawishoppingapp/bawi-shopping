import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_CONFIG_MODULE } from "../../../../../modules/business-config"
import type BusinessConfigModuleService from "../../../../../modules/business-config/service"
import { updateConfigEntrySchema } from "../../../../../modules/business-config/schemas"
import { DEFAULT_BUSINESS_CONFIG_ENTRIES } from "../../../../../modules/business-config/defaults"
import { updateBusinessConfigEntryWorkflow } from "../../../../../workflows/update-business-config-entry"

/** Admin-only (see middlewares.ts). Only a key that's part of the known
 * default set can be written - this is a fixed configuration surface, not
 * an arbitrary key-value store a caller can pollute. */
export async function PUT(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { category, key } = req.params

  const defaultEntry = DEFAULT_BUSINESS_CONFIG_ENTRIES.find(
    (entry) => entry.category === category && entry.key === key
  )
  if (!defaultEntry) {
    res.status(404).json({ message: "Unknown configuration key" })
    return
  }

  const parsed = updateConfigEntrySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() })
    return
  }

  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const previousValue = await businessConfigModuleService.getValue(category, key)

  const adminUserId = req.auth_context.actor_id

  const { result } = await updateBusinessConfigEntryWorkflow(req.scope).run({
    input: {
      adminUserId,
      category: defaultEntry.category,
      key,
      value: parsed.data.value,
      valueType: defaultEntry.value_type,
      label: defaultEntry.label,
      isPlaceholder: defaultEntry.is_placeholder,
      isSensitive: defaultEntry.is_sensitive ?? false,
      previousValueForAudit: previousValue,
    },
  })

  res.json({ entry: result.entry })
}
