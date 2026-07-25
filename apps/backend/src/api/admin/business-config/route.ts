import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_CONFIG_MODULE } from "../../../modules/business-config"
import type BusinessConfigModuleService from "../../../modules/business-config/service"
import { DEFAULT_BUSINESS_CONFIG_ENTRIES } from "../../../modules/business-config/defaults"

/** Admin-only (see middlewares.ts). Merges stored rows with code-level
 * defaults for any key not yet persisted, so the admin UI always shows
 * every known configuration key even before the seed script has run. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )

  const stored = await businessConfigModuleService.listBusinessConfigEntries({})
  const storedByCategoryKey = new Map(stored.map((row) => [`${row.category}:${row.key}`, row]))

  const entries = DEFAULT_BUSINESS_CONFIG_ENTRIES.map((defaultEntry) => {
    const existing = storedByCategoryKey.get(`${defaultEntry.category}:${defaultEntry.key}`)
    return {
      category: defaultEntry.category,
      key: defaultEntry.key,
      value: existing ? existing.value : defaultEntry.value,
      value_type: defaultEntry.value_type,
      label: defaultEntry.label,
      description: defaultEntry.description ?? null,
      is_placeholder: existing ? existing.is_placeholder : defaultEntry.is_placeholder,
      is_sensitive: defaultEntry.is_sensitive ?? false,
      updated_by: existing?.updated_by ?? null,
      updated_at: existing?.updated_at ?? null,
    }
  })

  res.json({ entries })
}
