import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { listCategories } from "@/features/products/services/products-client"
import { ProductForm } from "@/features/products/components/product-form"
import { createProductAction } from "@/features/products/actions/create-product"

export default async function NewProductPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const categories = await listCategories(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Create a product</h1>
        <p className="text-sm text-neutral-500">
          Saved as a draft first - you can add images and submit for review afterward.
        </p>
      </div>
      <ProductForm action={createProductAction} categories={categories} submitLabel="Save draft" />
    </main>
  )
}
