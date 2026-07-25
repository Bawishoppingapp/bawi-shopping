import { z } from "@medusajs/framework/zod"

export const addCartItemSchema = z.object({
  variant_id: z.string().min(1),
  quantity: z.number().int().positive(),
})

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
})

export const mergeCartSchema = z.object({
  guest_cart_id: z.string().min(1).optional(),
})

export type AddCartItemInput = z.infer<typeof addCartItemSchema>
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>
export type MergeCartInput = z.infer<typeof mergeCartSchema>
