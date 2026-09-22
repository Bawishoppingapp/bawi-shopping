import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Publishable API keys are public client credentials. Expose the currently
 * active one so mobile installs can recover after a key rotation instead of
 * becoming unable to register customers or use Store API routes.
 * Never expose secret API keys from this endpoint.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const apiKeyModule = req.scope.resolve(Modules.API_KEY)
  const keys = await apiKeyModule.listApiKeys({ type: "publishable" })
  const active = keys.find((key) => !key.revoked_at && !key.deleted_at)

  res.setHeader("Cache-Control", "no-store")
  if (!active) {
    res.status(503).json({ message: "Store configuration is unavailable" })
    return
  }

  res.json({ publishable_key: active.token })
}
