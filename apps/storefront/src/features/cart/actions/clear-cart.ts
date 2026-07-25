"use server"

import { revalidatePath } from "next/cache"
import { clearCart as clearCartRequest } from "../services/cart-client"

export async function clearCartAction(): Promise<void> {
  await clearCartRequest()
  revalidatePath("/", "layout")
}
