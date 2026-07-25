import { z } from "zod"

const optionalPrice = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().int().positive("Price must be greater than zero").optional()
)

const variantSchema = z.object({
  color: z.string().trim().min(1, "Color is required").max(60),
  size: z.string().trim().min(1, "Size is required").max(60),
  price: optionalPrice,
  inventory_quantity: z.coerce
    .number()
    .int("Inventory must be a whole number")
    .min(0, "Inventory cannot be negative"),
})

function hasDuplicateVariant(variants: { color: string; size: string }[]): boolean {
  const seen = new Set<string>()
  for (const variant of variants) {
    const key = `${variant.color.trim().toLowerCase()}::${variant.size.trim().toLowerCase()}`
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

export const productFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  category_id: z.string().trim().min(1, "Category is required"),
  base_price: z.coerce.number().int().positive("Base price must be greater than zero"),
  variants: z
    .array(variantSchema)
    .min(1, "At least one color/size variant is required")
    .refine((variants) => !hasDuplicateVariant(variants), {
      message: "Duplicate color/size combination",
    }),
})

export type ProductFormInput = z.infer<typeof productFormSchema>
