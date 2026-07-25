import { MedusaService } from "@medusajs/framework/utils"
import { BusinessConfigEntry } from "./models/business-config-entry"
import { DEFAULT_BUSINESS_CONFIG_ENTRIES } from "./defaults"

const DEFAULTS_BY_CATEGORY_KEY = new Map(
  DEFAULT_BUSINESS_CONFIG_ENTRIES.map((entry) => [`${entry.category}:${entry.key}`, entry.value])
)

class BusinessConfigModuleService extends MedusaService({
  BusinessConfigEntry,
}) {
  /** Returns { key: value } for every entry in a category, falling back to
   * the code-level default for any key not yet seeded/overridden in the
   * database - so the system behaves correctly even before the seed
   * script runs, and a stored row always wins once one exists. */
  async getCategoryValues(category: string): Promise<Record<string, unknown>> {
    const rows = await this.listBusinessConfigEntries({ category })
    const values: Record<string, unknown> = Object.fromEntries(
      rows.map((row) => [row.key, row.value])
    )
    for (const defaultEntry of DEFAULT_BUSINESS_CONFIG_ENTRIES) {
      if (defaultEntry.category === category && !(defaultEntry.key in values)) {
        values[defaultEntry.key] = DEFAULTS_BY_CATEGORY_KEY.get(`${category}:${defaultEntry.key}`)
      }
    }
    return values
  }

  async getValue(category: string, key: string): Promise<unknown> {
    const [row] = await this.listBusinessConfigEntries({ category, key })
    if (row) {
      return row.value
    }
    return DEFAULTS_BY_CATEGORY_KEY.get(`${category}:${key}`)
  }

  /**
   * Typed feature-flag reader. Fails safe: a flag that doesn't exist yet,
   * or whose stored value isn't literally `true`, resolves to `false` -
   * there is no code path where an unconfigured/malformed flag is treated
   * as enabled.
   */
  async getFeatureFlag(key: string): Promise<boolean> {
    const value = await this.getValue("feature_flag", key)
    return value === true
  }

  /** Every entry still at its seeded development/staging default - the
   * production-readiness check's data source (see docs/DECISIONS.md). */
  async listPlaceholders() {
    return this.listBusinessConfigEntries({ is_placeholder: true })
  }
}

export default BusinessConfigModuleService
