import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BUSINESS_CONFIG_MODULE } from "../modules/business-config"
import type BusinessConfigModuleService from "../modules/business-config/service"
import { FEATURE_FLAG_KEYS } from "../modules/business-config/defaults"

/**
 * Reports every business-configuration value still at its seeded
 * development/staging default, and the current state of every real-money/
 * real-communication feature flag. Exits non-zero while any placeholder
 * remains, per docs/DECISIONS.md rule #11 ("prevent production launch if
 * required business configuration still contains placeholder values").
 *
 * This does not itself block anything - no CI pipeline runs it
 * automatically yet (see docs/IMPLEMENTATION-PLAN.md) - it's a report an
 * operator runs deliberately before flipping any real Stripe key into
 * production.
 *
 * Usage: npx medusa exec ./src/scripts/check-production-readiness.ts
 */
export default async function checkProductionReadiness({ container }: ExecArgs) {
  const businessConfigModuleService: BusinessConfigModuleService = container.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const placeholders = await businessConfigModuleService.listPlaceholders()

  logger.info("=== Production readiness: placeholder business-configuration values ===")
  if (placeholders.length === 0) {
    logger.info("None - every placeholder value has been replaced.")
  } else {
    for (const row of placeholders) {
      logger.warn(`  [${row.category}] ${row.key} = ${JSON.stringify(row.value)} - "${row.label}"`)
    }
  }

  logger.info("=== Production readiness: real-operation feature flags ===")
  for (const key of FEATURE_FLAG_KEYS) {
    const enabled = await businessConfigModuleService.getFeatureFlag(key)
    logger.info(`  ${key} = ${enabled}`)
  }

  if (placeholders.length > 0) {
    logger.error(
      `Production readiness check FAILED: ${placeholders.length} placeholder value(s) remain. Replace and approve each before real production launch (see docs/DECISIONS.md).`
    )
    process.exitCode = 1
    return
  }

  logger.info("Production readiness check passed: no placeholder business-configuration values remain.")
}
