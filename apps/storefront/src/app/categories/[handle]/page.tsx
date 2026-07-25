import { notFound } from "next/navigation"
import { getLocale } from "@bawi/i18n/server"
import { listCategories, flattenCategories } from "@/features/discovery/services/discovery-client"
import { DiscoveryView, type DiscoveryViewParams } from "@/features/discovery/components/discovery-view"

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<DiscoveryViewParams>
}) {
  const { handle } = await params
  const resolvedSearchParams = await searchParams
  const locale = await getLocale()

  const categories = await listCategories(locale)
  const category = flattenCategories(categories).find((c) => c.handle === handle)

  if (!category) {
    notFound()
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">{category.name}</h1>
      <DiscoveryView params={resolvedSearchParams} locale={locale} categoryId={category.id} />
    </main>
  )
}
