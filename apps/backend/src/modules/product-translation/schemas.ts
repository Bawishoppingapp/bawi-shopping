import { z } from "@medusajs/framework/zod"
import { TRANSLATABLE_LOCALES } from "../category-translation/locales"

export const upsertProductTranslationSchema = z.object({
  locale: z.enum(TRANSLATABLE_LOCALES),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
})

export const rejectProductTranslationSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required").max(1000),
})
