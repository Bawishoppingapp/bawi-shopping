import { z } from "@medusajs/framework/zod"

export const sourceSchema = z.object({
  front: z.string().url(), back: z.string().url(), detail: z.string().url().optional(),
  attributes: z.object({
    category: z.string().trim().min(1).max(100), color: z.string().trim().min(1).max(100),
    material: z.string().trim().min(1).max(100), pattern: z.string().trim().min(1).max(100),
    sleeves: z.string().trim().min(1).max(100), neckline: z.string().trim().min(1).max(100),
    length: z.string().trim().min(1).max(100), fit: z.string().trim().min(1).max(100),
    sizes: z.string().trim().min(1).max(200),
  }),
}).refine((s) => s.front !== s.back, "Use distinct front and back photos")
export type ImageSources = z.infer<typeof sourceSchema>
export const validationSchema = z.object({
  status: z.enum(["APPROVED", "NEEDS_CORRECTION", "ADMIN_REVIEW"]),
  reasons: z.array(z.string().max(500)).max(20),
})
export const generationSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), jobId: z.string().min(1).max(200) }),
  z.object({ status: z.literal("succeeded"), jobId: z.string().min(1).max(200), imageUrl: z.string().url().refine((url) => url.startsWith("https://")) }),
  z.object({ status: z.literal("failed"), jobId: z.string().min(1).max(200) }),
])
export type ImageWorkflow = {
  id: string; sources: ImageSources; modelProfile: string; provider: string;
  status: "validating" | "needs_correction" | "admin_review" | "queued" | "generating" | "review" | "approved" | "rejected" | "failed";
  validation: z.infer<typeof validationSchema> | null;
  jobId?: string; imageUrl?: string; sellerApproved?: boolean;
  regenerationCount: number; createdAt: string; updatedAt: string;
  error?: "provider_unavailable" | "provider_error" | "generation_failed" | "generation_timeout";
}
export const pending = (state: ImageWorkflow) => ["validating", "queued", "generating"].includes(state.status)
export function ownedSources(sources: ImageSources, originals: string[]) {
  return [sources.front, sources.back, sources.detail].filter(Boolean).every((url) => originals.includes(url!))
}
