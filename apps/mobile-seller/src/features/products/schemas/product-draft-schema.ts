import { z } from "zod";

// Mirrors apps/backend/src/modules/product-listing/schemas.ts's
// productDraftSchema - same constraints, checked client-side first for a
// fast field-level error, but the backend re-validates regardless.
const variantSchema = z.object({
  color: z.string().trim().min(1, "Color is required"),
  size: z.string().trim().min(1, "Size is required"),
  price: z.number().int().positive().optional(),
  inventory_quantity: z.number().int().min(0, "Inventory can't be negative"),
});

export const productDraftSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  category_id: z.string().trim().min(1, "Category is required"),
  base_price: z.number().int().positive("Base price must be greater than zero"),
  variants: z
    .array(variantSchema)
    .min(1, "At least one color/size variant is required")
    .refine(
      (variants) => {
        const seen = new Set(variants.map((v) => `${v.color.toLowerCase()}-${v.size.toLowerCase()}`));
        return seen.size === variants.length;
      },
      { message: "Duplicate color/size combination" }
    ),
});

export type ProductDraftFormInput = z.infer<typeof productDraftSchema>;
