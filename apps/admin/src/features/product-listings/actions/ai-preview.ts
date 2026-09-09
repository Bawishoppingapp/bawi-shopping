"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { updateAiPreview } from "../services/product-listings-client"

export async function updateAiPreviewAction(listingId: string, formData: FormData) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) throw new Error("Unauthorized")
  await updateAiPreview(token, listingId, formData)
  revalidatePath(`/products/${listingId}`)
}
