"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import { deleteCategory, CategoriesError } from "../services/categories-client"
import type { CategoryFormState } from "../constants"

export async function deleteCategoryAction(
  categoryId: string,
  // Required by useActionState's (state, formData) call signature after
  // .bind(null, categoryId) - delete takes no form input of its own.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: CategoryFormState
): Promise<CategoryFormState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  try {
    await deleteCategory(sessionToken, categoryId)
  } catch (error) {
    const message =
      error instanceof CategoriesError ? error.message : "Something went wrong. Please try again."
    return { status: "error", fieldErrors: {}, formError: message }
  }

  revalidatePath("/categories")
  redirect("/categories")
}
