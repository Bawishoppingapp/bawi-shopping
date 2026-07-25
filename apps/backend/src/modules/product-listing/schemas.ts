import { z } from "@medusajs/framework/zod"

const variantInputSchema = z.object({
  color: z.string().trim().min(1, "Color is required").max(60),
  size: z.string().trim().min(1, "Size is required").max(60),
  price: z.number().int().positive("Price must be greater than zero").optional(),
  inventory_quantity: z
    .number()
    .int("Inventory must be a whole number")
    .min(0, "Inventory cannot be negative"),
})

function hasDuplicateVariant(variants: { color: string; size: string }[]): boolean {
  const seen = new Set<string>()
  for (const variant of variants) {
    const key = `${variant.color.trim().toLowerCase()}::${variant.size.trim().toLowerCase()}`
    if (seen.has(key)) {
      return true
    }
    seen.add(key)
  }
  return false
}

export const productDraftSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  category_id: z.string().trim().min(1, "Category is required"),
  // Integer minor units (e.g. 4999 = $49.99), USD only for v1.
  base_price: z.number().int().positive("Base price must be greater than zero"),
  variants: z
    .array(variantInputSchema)
    .min(1, "At least one color/size variant is required")
    .refine((variants) => !hasDuplicateVariant(variants), {
      message: "Duplicate color/size combination",
    }),
})

export type ProductDraftInput = z.infer<typeof productDraftSchema>

export const addProductImageSchema = z.object({
  url: z.string().trim().min(1, "Image URL is required"),
  is_primary: z.boolean().optional().default(false),
})

export const rejectProductListingSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required").max(1000),
})
