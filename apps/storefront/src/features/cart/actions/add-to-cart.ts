"use server"

import { z } from "zod"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { CART_ID_COOKIE, CART_ID_COOKIE_MAX_AGE_SECONDS, type CartActionState } from "../constants"
import { addCartItem, CartError } from "../services/cart-client"

const addToCartSchema = z.object({
  variantId: z.string().min(1, "Select a size and color first"),
  quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
})

export async function addToCart(
  _prevState: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  const parsed = addToCartSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
  })

  if (!parsed.success) {
    return { status: "error", formError: parsed.error.issues[0]?.message }
  }

  try {
    const cart = await addCartItem(parsed.data.variantId, parsed.data.quantity)

    const cookieStore = await cookies()
    cookieStore.set(CART_ID_COOKIE, cart.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CART_ID_COOKIE_MAX_AGE_SECONDS,
    })

    revalidatePath("/", "layout")
  } catch (error) {
    if (error instanceof CartError) {
      return { status: "error", formError: error.message }
    }
    return { status: "error", formError: "Could not add this item to your cart." }
  }

  return { status: "idle" }
}
