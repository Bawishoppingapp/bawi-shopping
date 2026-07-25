"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import type { CartActionState } from "../constants"
import { updateCartItemQuantity, CartError } from "../services/cart-client"

const updateQuantitySchema = z.object({
  lineItemId: z.string().min(1),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
})

export async function updateQuantity(
  _prevState: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const parsed = updateQuantitySchema.safeParse({
    lineItemId: formData.get("lineItemId"),
    quantity: formData.get("quantity"),
  })

  if (!parsed.success) {
    return { status: "error", formError: parsed.error.issues[0]?.message }
  }

  try {
    await updateCartItemQuantity(parsed.data.lineItemId, parsed.data.quantity)
    revalidatePath("/", "layout")
  } catch (error) {
    if (error instanceof CartError) {
      return { status: "error", formError: error.message }
    }
    return { status: "error", formError: "Could not update the quantity." }
  }

  return { status: "idle" }
}
