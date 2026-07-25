import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStockLocationsWorkflow } from "@medusajs/medusa/core-flows"

const DEFAULT_STOCK_LOCATION_NAME = "Bawi Fulfillment Center"

/**
 * v1 uses a single platform-level stock location for every seller's
 * inventory (per-seller stock locations are a documented future refinement,
 * not required for this slice - see docs/ARCHITECTURE.md). Idempotent: get
 * to avoid creating duplicates on every product creation.
 */
export async function getOrCreateDefaultStockLocationId(
  container: MedusaContainer
): Promise<string> {
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION)

  const [existing] = await stockLocationModuleService.listStockLocations({
    name: DEFAULT_STOCK_LOCATION_NAME,
  })
  if (existing) {
    return existing.id
  }

  const { result } = await createStockLocationsWorkflow(container).run({
    input: { locations: [{ name: DEFAULT_STOCK_LOCATION_NAME }] },
  })

  return result[0].id
}
