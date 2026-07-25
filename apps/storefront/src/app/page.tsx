import Link from "next/link"
import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { ProductGrid, ProductGridEmpty, ProductGridError } from "@bawi/ui"
import { listCategories, searchProducts } from "@/features/discovery/services/discovery-client"
import { ProductCardItem } from "@/features/discovery/components/product-card-item"
import { SearchBox } from "@/features/discovery/components/search-box"

const NEW_ARRIVALS_LIMIT = 8
const TOP_LEVEL_CATEGORIES_LIMIT = 6

export default async function HomePage() {
  const locale = await getLocale()

  const [categoriesResult, newArrivalsResult] = await Promise.allSettled([
    listCategories(locale),
    searchProducts({ sort: "newest", limit: NEW_ARRIVALS_LIMIT, locale }),
  ])

  const categories =
    categoriesResult.status === "fulfilled" ? categoriesResult.value : []

  return (
    <main className="flex flex-col gap-16 pb-16">
      <section className="flex flex-col items-center gap-4 bg-neutral-50 px-4 py-20 text-center">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-neutral-900">
          {translate(locale, "home.hero.title")}
        </h1>
        <p className="max-w-md text-neutral-600">{translate(locale, "home.hero.subtitle")}</p>
        <SearchBox placeholder={translate(locale, "search.placeholder")} />
        <Link
          href="/search"
          className="mt-2 inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          {translate(locale, "home.hero.cta")}
        </Link>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {translate(locale, "home.shopByCategory")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, TOP_LEVEL_CATEGORIES_LIMIT).map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.handle}`}
                className="flex items-center justify-center rounded-md border border-neutral-200 px-4 py-6 text-center text-sm font-medium text-neutral-900 hover:border-neutral-400"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            {translate(locale, "home.newArrivals")}
          </h2>
          <Link href="/search?sort=newest" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
            {translate(locale, "home.viewAll")}
          </Link>
        </div>

        {newArrivalsResult.status === "rejected" ? (
          <ProductGridError message={translate(locale, "search.error")} />
        ) : newArrivalsResult.value.products.length === 0 ? (
          <ProductGridEmpty
            title={translate(locale, "search.noResults")}
            description={translate(locale, "search.noResultsHint")}
          />
        ) : (
          <ProductGrid>
            {newArrivalsResult.value.products.map((item) => (
              <ProductCardItem
                key={item.productCode}
                item={item}
                soldOutLabel={translate(locale, "product.soldOut")}
              />
            ))}
          </ProductGrid>
        )}
      </section>
    </main>
  )
}
