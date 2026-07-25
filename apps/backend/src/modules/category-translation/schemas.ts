import { z } from "@medusajs/framework/zod"
import { TRANSLATABLE_LOCALES } from "./locales"

const translationsSchema = z
  .partialRecord(z.enum(TRANSLATABLE_LOCALES), z.string().trim().min(1).max(200))
  .optional()

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  parent_category_id: z.string().trim().min(1).nullable().optional(),
  is_active: z.boolean().optional().default(true),
  translations: translationsSchema,
})

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200).optional(),
  parent_category_id: z.string().trim().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
  translations: translationsSchema,
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
