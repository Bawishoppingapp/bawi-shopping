import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listCategories, flattenWithDepth } from "@/features/categories/services/categories-client"
import { CategoryForm } from "@/features/categories/components/category-form"

export const dynamic = "force-dynamic"

export default async function NewCategoryPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const categories = await listCategories(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <nav className="flex gap-4 text-sm">
        <Link href="/categories" className="text-neutral-500 hover:underline">
          Categories
        </Link>
        <span className="font-medium text-neutral-900">New</span>
      </nav>

      <h1 className="text-2xl font-semibold text-neutral-900">New category</h1>

      <CategoryForm mode="create" parentOptions={flattenWithDepth(categories)} />
    </main>
  )
}
