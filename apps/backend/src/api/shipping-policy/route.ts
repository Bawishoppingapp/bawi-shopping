import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_CONFIG_MODULE } from "../../modules/business-config"
import type BusinessConfigModuleService from "../../modules/business-config/service"

/**
 * Public, unauthenticated. Read-only passthrough of the subset of
 * business-config's `shipping`/`returns` categories that's safe and useful
 * to show on a product detail page before a cart even exists - the same
 * values `cart-response.ts` already reads to compute a cart's own
 * shipping estimate, just not gated behind having an active cart.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )

  const [shippingConfig, returnsConfig] = await Promise.all([
    businessConfigModuleService.getCategoryValues("shipping"),
    businessConfigModuleService.getCategoryValues("returns"),
  ])

  res.json({
    standard_shipping_fee_cents: Number(shippingConfig.standard_shipping_fee_cents ?? 0),
    free_shipping_threshold_cents: Number(shippingConfig.free_shipping_threshold_cents ?? 0),
    return_window_days: Number(returnsConfig.return_window_days ?? 0),
  })
}
