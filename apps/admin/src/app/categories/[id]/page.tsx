import Link from "next/link"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import {
  getCategory,
  listCategories,
  parentOptionsExcluding,
  CategoriesError,
} from "@/features/categories/services/categories-client"
import { CategoryForm } from "@/features/categories/components/category-form"
import { DeleteCategoryButton } from "@/features/categories/components/delete-category-button"

export const dynamic = "force-dynamic"

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  let category
  try {
    category = await getCategory(sessionToken, id)
  } catch (error) {
    if (error instanceof CategoriesError) {
      notFound()
    }
    throw error
  }

  const categories = await listCategories(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <nav className="flex gap-4 text-sm">
        <Link href="/categories" className="text-neutral-500 hover:underline">
          Categories
        </Link>
        <span className="font-medium text-neutral-900">{category.name}</span>
      </nav>

      <h1 className="text-2xl font-semibold text-neutral-900">Edit category</h1>

      <CategoryForm
        mode="edit"
        categoryId={category.id}
        parentOptions={parentOptionsExcluding(categories, category.id)}
        initialValues={{
          name: category.name,
          parent_category_id: category.parent_category_id,
          is_active: category.is_active,
          translations: category.translations,
        }}
      />

      <div className="border-t border-neutral-200 pt-6">
        <p className="mb-3 text-sm text-neutral-500">
          Deleting is only possible when this category has no child categories and no products
          assigned.
        </p>
        <DeleteCategoryButton categoryId={category.id} />
      </div>
    </main>
  )
}
