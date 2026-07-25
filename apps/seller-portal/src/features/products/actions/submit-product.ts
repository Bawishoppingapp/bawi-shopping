"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { submitProductForReview } from "../services/products-client"

export async function submitProductAction(listingId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  await submitProductForReview(sessionToken, listingId)
  revalidatePath(`/products/${listingId}`)
  revalidatePath("/products")
}
