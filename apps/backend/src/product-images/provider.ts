import { MedusaError } from "@medusajs/framework/utils"
import { generationSchema, validationSchema, type ImageSources } from "./contracts"
import type { z } from "@medusajs/framework/zod"

export interface ProductImageGenerationProvider {
  name: string
  validateSourceImages(sources: ImageSources, idempotencyKey: string): Promise<z.infer<typeof validationSchema>>
  generateStandardizedModelImage(sources: ImageSources, modelProfile: string, idempotencyKey: string): Promise<z.infer<typeof generationSchema>>
  getGenerationStatus(jobId: string): Promise<z.infer<typeof generationSchema>>
}

const FASHN_API = "https://api.fashn.ai/v1"

/** FASHN's native API adapter. The key and licensed identity reference stay server-side. */
export function imageProvider(): ProductImageGenerationProvider | null {
  const token = process.env.BAWI_IMAGE_PROVIDER_KEY
  const modelProfile = process.env.BAWI_IMAGE_MODEL_PROFILE
  const faceReference = process.env.BAWI_IMAGE_FACE_REFERENCE_URL
  if (!token || !modelProfile || !faceReference) return null
  try {
    const ref = new URL(faceReference)
    if (ref.protocol !== "https:" || ref.username || ref.password || ref.search || ref.hash) return null
  } catch { return null }

  async function request(path: string, method: "POST" | "GET", body?: unknown) {
    const response = await fetch(`${FASHN_API}${path}`, {
      method, redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Image provider request failed")
    return response.json()
  }
  return {
    name: "fashn:product-to-model",
    async validateSourceImages() {
      // FASHN has no source-photo compliance endpoint. Require a human check
      // rather than claiming an automated approval we cannot substantiate.
      return validationSchema.parse({ status: "ADMIN_REVIEW", reasons: ["Bawi review required: verify both original photos meet source-photo requirements before generation"] })
    },
    async generateStandardizedModelImage(sources, modelProfile, key) {
      if (modelProfile !== process.env.BAWI_IMAGE_MODEL_PROFILE) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Model profile changed")
      const result = await request("/run", "POST", {
        model_name: "product-to-model",
        inputs: {
          product_image: sources.front,
          face_reference: faceReference,
          face_reference_mode: "match_reference",
          prompt: "Bawi fashion catalog. Full-length single model, neutral studio background, soft even light, centered editorial composition. Preserve the garment exactly: its color, cut, print, neckline, sleeves, fastenings, length, fabric texture and silhouette. Do not add accessories or alter the garment.",
          aspect_ratio: "3:4",
          resolution: "1k",
          generation_mode: "fast",
          num_images: 1,
          output_format: "png",
          return_base64: true,
        },
      })
      if (!result || typeof result.id !== "string") throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Image provider response was invalid")
      return generationSchema.parse({ status: "pending", jobId: result.id })
    },
    async getGenerationStatus(jobId) {
      const result = await request(`/status/${encodeURIComponent(jobId)}`, "GET")
      if (result.status === "starting" || result.status === "in_queue" || result.status === "processing") {
        return generationSchema.parse({ status: "pending", jobId })
      }
      if (result.status === "failed") return generationSchema.parse({ status: "failed", jobId })
      const output = Array.isArray(result.output) ? result.output[0] : null
      if (result.status !== "completed" || typeof output !== "string" || !output.startsWith("data:image/png;base64,")) {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Image provider result was invalid")
      }
      return generationSchema.parse({ status: "succeeded", jobId, imageData: output })
    },
  }
}
