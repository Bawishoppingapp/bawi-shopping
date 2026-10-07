import { MedusaError } from "@medusajs/framework/utils"
import { generationSchema, validationSchema, type ImageSources } from "./contracts"
import type { z } from "@medusajs/framework/zod"

export interface ProductImageGenerationProvider {
  name: string
  validateSourceImages(sources: ImageSources, idempotencyKey: string): Promise<z.infer<typeof validationSchema>>
  generateStandardizedModelImage(sources: ImageSources, modelProfile: string, idempotencyKey: string): Promise<z.infer<typeof generationSchema>>
  getGenerationStatus(jobId: string): Promise<z.infer<typeof generationSchema>>
}

/** Server-only gateway contract; a vendor adapter must implement this protocol.
 * No default/mock production vendor. Credentials and licensed profile are all required.
 */
export function imageProvider(): ProductImageGenerationProvider | null {
  const endpoint = process.env.BAWI_IMAGE_PROVIDER_URL
  const token = process.env.BAWI_IMAGE_PROVIDER_KEY
  if (!endpoint || !token || !process.env.BAWI_IMAGE_MODEL_PROFILE) return null
  let base: URL
  try { base = new URL(endpoint) } catch { return null }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) return null
  async function request(path: string, body?: unknown, key?: string) {
    const response = await fetch(`${base.href.replace(/\/$/, "")}${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Image provider request failed")
    return response.json()
  }
  return {
    name: base.origin,
    async validateSourceImages(sources, key) {
      return validationSchema.parse(await request("/validate", { sources, minimumResolution: 1024, checks: ["full_garment", "single_product", "straight_on", "neutral_background", "even_lighting", "true_color", "no_screenshot", "no_watermark_text_border", "no_obstruction", "minimal_folds"] }, `${key}:validate`))
    },
    async generateStandardizedModelImage(sources, modelProfile, key) {
      return generationSchema.parse(await request("/generations", { sources, modelProfile, count: 1, style: "Bawi: consistent neutral background, crop, lighting and composition; preserve garment color, cut, pattern, neckline, sleeves, fastenings, length, texture and silhouette" }, key))
    },
    async getGenerationStatus(jobId) { return generationSchema.parse(await request(`/generations/${encodeURIComponent(jobId)}`)) },
  }
}
