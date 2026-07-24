import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * TEST-ONLY. Exposes the seeded default publishable API key so the
 * integration suite can call /store/* endpoints without hardcoding a key
 * that's regenerated per database. Gated on ENABLE_TEST_SUPPORT_ROUTES
 * rather than NODE_ENV because `medusa develop` forces NODE_ENV=development.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  if (process.env.ENABLE_TEST_SUPPORT_ROUTES !== "true") {
    res.status(404).json({ message: "Not found" })
    return
  }

  const apiKeyModuleService = req.scope.resolve(Modules.API_KEY)
  const [key] = await apiKeyModuleService.listApiKeys({ type: "publishable" })

  res.json({ token: key?.token })
}
