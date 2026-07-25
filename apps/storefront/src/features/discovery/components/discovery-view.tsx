import { translate, type Locale } from "@bawi/i18n"
import { ProductGrid, ProductGridEmpty, ProductGridError } from "@bawi/ui"
import {
  listCategories,
  listBrands,
  searchProducts,
  flattenCategoriesWithDepth,
  type ProductSortOption,
} from "../services/discovery-client"
import { ProductCardItem } from "./product-card-item"
import { FilterControls } from "./filter-controls"
import { SortSelect } from "./sort-select"
import { LoadMoreProducts } from "./load-more-products"

export interface DiscoveryViewParams {
  q?: string
  category?: string
  brand?: string
  size?: string
  color?: string
  price_min?: string
  price_max?: string
  available?: string
  sort?: string
}

const VALID_SORTS: ProductSortOption[] = ["newest", "price_asc", "price_desc"]
const PAGE_SIZE = 24

/**
 * Shared by the homepage's "new arrivals" rail (no filters, just sort=newest
 * limit), the category browse page (category pinned), and the search page
 * (full filter/sort/pagination UI). Server Component: the initial page of
 * results is fetched server-side so the URL is always the source of truth
 * and results are shareable/bookmarkable (docs/PRD.md §9.9).
 */
export async function DiscoveryView({
  params,
  locale,
  categoryId,
  showFilters = true,
}: {
  params: DiscoveryViewParams
  locale: Locale
  categoryId?: string
  showFilters?: boolean
}) {
  const sort = VALID_SORTS.includes(params.sort as ProductSortOption)
    ? (params.sort as ProductSortOption)
    : "newest"

  const searchQuery = {
    q: params.q,
    locale,
    sort,
    limit: PAGE_SIZE,
    filters: {
      categoryId: categoryId ?? params.category,
      brandSlug: params.brand,
      size: params.size,
      color: params.color,
      priceMin: params.price_min ? Number.parseInt(params.price_min, 10) : undefined,
      priceMax: params.price_max ? Number.parseInt(params.price_max, 10) : undefined,
      availableOnly: params.available === "true",
    },
  }

  let result
  let loadError = false
  try {
    result = await searchProducts({
      q: searchQuery.q,
      category: searchQuery.filters.categoryId,
      brand: searchQuery.filters.brandSlug,
      size: searchQuery.filters.size,
      color: searchQuery.filters.color,
      priceMin: searchQuery.filters.priceMin,
      priceMax: searchQuery.filters.priceMax,
      available: searchQuery.filters.availableOnly,
      sort,
      limit: PAGE_SIZE,
      locale,
    })
  } catch {
    loadError = true
  }

  let categories: Awaited<ReturnType<typeof listCategories>> = []
  let brands: Awaited<ReturnType<typeof listBrands>> = []
  if (showFilters) {
    try {
      ;[categories, brands] = await Promise.all([listCategories(locale), listBrands()])
    } catch {
      // Filter option lists are a progressive enhancement - the grid above
      // still works without them.
    }
  }

  if (loadError || !result) {
    return <ProductGridError message={translate(locale, "search.error")} />
  }

  const baseParams = {
    q: searchQuery.q,
    category: searchQuery.filters.categoryId,
    brand: searchQuery.filters.brandSlug,
    size: searchQuery.filters.size,
    color: searchQuery.filters.color,
    priceMin: searchQuery.filters.priceMin,
    priceMax: searchQuery.filters.priceMax,
    available: searchQuery.filters.availableOnly,
    sort,
    locale,
    limit: PAGE_SIZE,
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {showFilters && (
        <FilterControls
          categories={flattenCategoriesWithDepth(categories)}
          brands={brands}
          sizes={result.facets.sizes}
          colors={result.facets.colors}
          labels={{
            title: translate(locale, "filters.title"),
            category: translate(locale, "filters.category"),
            allCategories: translate(locale, "filters.allCategories"),
            all: translate(locale, "filters.all"),
            brand: translate(locale, "filters.brand"),
            size: translate(locale, "filters.size"),
            color: translate(locale, "filters.color"),
            price: translate(locale, "filters.price"),
            priceMin: translate(locale, "filters.priceMin"),
            priceMax: translate(locale, "filters.priceMax"),
            availability: translate(locale, "filters.availability"),
            inStockOnly: translate(locale, "filters.inStockOnly"),
            apply: translate(locale, "filters.apply"),
            clear: translate(locale, "filters.clear"),
            close: translate(locale, "filters.close"),
          }}
        />
      )}

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex justify-end">
          <SortSelect
            label={translate(locale, "sort.label")}
            newestLabel={translate(locale, "sort.newest")}
            priceAscLabel={translate(locale, "sort.priceAsc")}
            priceDescLabel={translate(locale, "sort.priceDesc")}
          />
        </div>

        {result.products.length === 0 ? (
          <ProductGridEmpty
            title={translate(locale, "search.noResults")}
            description={translate(locale, "search.noResultsHint")}
          />
        ) : (
          <>
            <ProductGrid>
              {result.products.map((item) => (
                <ProductCardItem
                  key={item.productCode}
                  item={item}
                  soldOutLabel={translate(locale, "product.soldOut")}
                />
              ))}
            </ProductGrid>
            <LoadMoreProducts
              baseParams={baseParams}
              initialCursor={result.next_cursor}
              initialHasMore={result.has_more}
              soldOutLabel={translate(locale, "product.soldOut")}
              loadMoreLabel={translate(locale, "pagination.loadMore")}
              loadingLabel={translate(locale, "pagination.loading")}
            />
          </>
        )}
      </div>
    </div>
  )
}
