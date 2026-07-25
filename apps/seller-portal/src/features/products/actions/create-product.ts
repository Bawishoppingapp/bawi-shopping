"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { productFormSchema } from "../schemas/product-schema"
import { createProduct, ProductsClientError } from "../services/products-client"
import type { ProductFormState } from "../constants"

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  let variants: unknown
  try {
    variants = JSON.parse(String(formData.get("variants_json") ?? "[]"))
  } catch {
    variants = []
  }

  const parsed = productFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category_id: formData.get("category_id"),
    base_price: formData.get("base_price"),
    variants,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0])
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  let listingId: string
  try {
    const { listing } = await createProduct(sessionToken, parsed.data)
    listingId = listing.id
  } catch (error) {
    const message =
      error instanceof ProductsClientError ? error.message : "Something went wrong. Please try again."
    return { status: "error", fieldErrors: {}, formError: message }
  }

  redirect(`/products/${listingId}`)
}
