"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import {
  approveProductListing,
  ProductListingsError,
} from "../services/product-listings-client"
import type { ReviewActionState } from "../constants"

export async function approveProduct(
  listingId: string,
  // Required by useActionState's (state, formData) call signature after
  // .bind(null, listingId) - approve takes no form input of its own.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ReviewActionState
): Promise<ReviewActionState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  try {
    await approveProductListing(sessionToken, listingId)
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
