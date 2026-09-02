import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { getCurrencyRates } from "../../currency-rates/currency-rates"

/** Public and read-only. Mobile calls Bawi once per session; Bawi performs
 * the external provider request at most twice daily per backend process. */
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    res.json(await getCurrencyRates())
  } catch {
    res.status(503).json({ code: "currency_rates_unavailable" })
  }
}
