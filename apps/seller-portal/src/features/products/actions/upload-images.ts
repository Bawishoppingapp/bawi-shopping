"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { uploadProductImages, ProductsClientError } from "../services/products-client"
import type { ImageUploadState } from "../constants"

export async function uploadImagesAction(
  listingId: string,
  _prevState: ImageUploadState,
  formData: FormData
): Promise<ImageUploadState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) {
    return { status: "error", message: "Choose at least one image file." }
  }

  const isPrimary = formData.get("is_primary") === "on"

  try {
    await uploadProductImages(sessionToken, listingId, files, isPrimary)
  } catch (error) {
    const message =
      error instanceof ProductsClientError ? error.message : "Could not upload images."
    return { status: "error", message }
  }

  revalidatePath(`/products/${listingId}`)
  return { status: "success" }
}
