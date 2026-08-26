import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_CONFIG_MODULE } from "../../modules/business-config"
import type BusinessConfigModuleService from "../../modules/business-config/service"

const SUPPORTED_CURRENCIES = ["usd", "etb"]

/**
 * Public, unauthenticated. Read-only passthrough of the subset of
 * business-config's `shipping`/`returns` categories that's safe and useful
 * to show on a product detail page before a cart even exists - the same
 * values `cart-response.ts` already reads to compute a cart's own
 * shipping estimate, just not gated behind having an active cart.
 *
 * `?currency=etb` selects that currency's shipping fee/threshold (see
 * defaults.ts - USD keys stay unsuffixed, every other currency has its
 * own explicit, independently-set key). Defaults to usd if omitted or
 * unrecognized.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const requestedCurrency = typeof req.query.currency === "string" ? req.query.currency : "usd"
  const currency = SUPPORTED_CURRENCIES.includes(requestedCurrency) ? requestedCurrency : "usd"
  const keySuffix = currency === "usd" ? "" : `_${currency}`

  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )

  const [shippingConfig, returnsConfig] = await Promise.all([
    businessConfigModuleService.getCategoryValues("shipping"),
    businessConfigModuleService.getCategoryValues("returns"),
  ])

  res.json({
    currency_code: currency,
    standard_shipping_fee_cents: Number(shippingConfig[`standard_shipping_fee_cents${keySuffix}`] ?? 0),
    free_shipping_threshold_cents: Number(
      shippingConfig[`free_shipping_threshold_cents${keySuffix}`] ?? 0
    ),
    return_window_days: Number(returnsConfig.return_window_days ?? 0),
  })
}
