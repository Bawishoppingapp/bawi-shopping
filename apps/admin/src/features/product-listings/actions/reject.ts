"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import {
  rejectProductListing,
  ProductListingsError,
} from "../services/product-listings-client"
import type { ReviewActionState } from "../constants"

const reasonSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required"),
})

export async function rejectProduct(
  listingId: string,
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const parsed = reasonSchema.safeParse({ reason: formData.get("reason") })
  if (!parsed.success) {
    return {
      status: "error",
      formError: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  try {
    await rejectProductListing(sessionToken, listingId, parsed.data.reason)
    revalidatePath("/products")
    return { status: "success" }
  } catch (error) {
    const message =
      error instanceof ProductListingsError
        ? error.message
        : "Something went wrong. Please try again."
    return { status: "error", formError: message }
  }
}
