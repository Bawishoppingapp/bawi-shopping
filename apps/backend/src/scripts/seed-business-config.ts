import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BUSINESS_CONFIG_MODULE } from "../modules/business-config"
import type BusinessConfigModuleService from "../modules/business-config/service"
import { DEFAULT_BUSINESS_CONFIG_ENTRIES } from "../modules/business-config/defaults"

/**
 * Idempotent: inserts every default row that doesn't already exist, never
 * overwrites a row an admin has already edited. Safe to re-run after
 * defaults.ts gains new keys.
 *
 * Usage: npx medusa exec ./src/scripts/seed-business-config.ts
 */
export default async function seedBusinessConfig({ container }: ExecArgs) {
  const businessConfigModuleService: BusinessConfigModuleService = container.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  let created = 0
  for (const entry of DEFAULT_BUSINESS_CONFIG_ENTRIES) {
    const [existing] = await businessConfigModuleService.listBusinessConfigEntries({
      category: entry.category,
      key: entry.key,
    })
    if (existing) {
      continue
    }
    await businessConfigModuleService.createBusinessConfigEntries({
      category: entry.category,
      key: entry.key,
      // model.json() infers an object-shaped TS type; jsonb genuinely
      // stores any JSON value (number/boolean/string/array included), so
      // this cast is a real, deliberate widening, not a type error.
      value: entry.value as Record<string, unknown>,
      value_type: entry.value_type,
      label: entry.label,
      description: entry.description ?? null,
      is_placeholder: entry.is_placeholder,
      is_sensitive: entry.is_sensitive ?? false,
    })
    created += 1
  }

  logger.info(`Seeded business config: ${created} new entries, ${DEFAULT_BUSINESS_CONFIG_ENTRIES.length - created} already present.`)
}
