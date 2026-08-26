import { z } from "@medusajs/framework/zod"

export const addWishlistItemSchema = z.object({
  product_code: z.string().trim().min(1),
})

export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>
