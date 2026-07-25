"use server"

import { revalidatePath } from "next/cache"
import { removeCartItem } from "../services/cart-client"

export async function removeItem(lineItemId: string): Promise<void> {
  await removeCartItem(lineItemId)
  revalidatePath("/", "layout")
}
