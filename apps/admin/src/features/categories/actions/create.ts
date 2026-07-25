"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import { createCategory, CategoriesError } from "../services/categories-client"
import { TRANSLATABLE_LOCALES, type CategoryFormState } from "../constants"

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  parent_category_id: z.string().trim().min(1).nullable(),
  is_active: z.boolean(),
})

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const parentValue = formData.get("parent_category_id")
  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    parent_category_id:
      typeof parentValue === "string" && parentValue.trim() ? parentValue : null,
    is_active: formData.get("is_active") === "on",
  })

  if (!parsed.success) {
    const fieldErrors: CategoryFormState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === "name") {
        fieldErrors.name = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  const translations: Record<string, string> = {}
  for (const { code } of TRANSLATABLE_LOCALES) {
    const value = formData.get(`translation_${code}`)
    if (typeof value === "string" && value.trim()) {
      translations[code] = value.trim()
    }
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  try {
    await createCategory(sessionToken, {
      name: parsed.data.name,
      parent_category_id: parsed.data.parent_category_id,
      is_active: parsed.data.is_active,
      translations,
    })
  } catch (error) {
    const message =
      error instanceof CategoriesError ? error.message : "Something went wrong. Please try again."
    return { status: "error", fieldErrors: {}, formError: message }
  }

  revalidatePath("/categories")
  redirect("/categories")
}
