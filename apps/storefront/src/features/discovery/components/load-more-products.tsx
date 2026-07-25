"use client"

import { useState } from "react"
import { Button, ProductGrid } from "@bawi/ui"
import { ProductCardItem } from "./product-card-item"
import { loadMoreProducts } from "../actions/load-more-products"
import type { ProductHit, ProductSearchParams } from "../services/discovery-client"

export function LoadMoreProducts({
  baseParams,
  initialCursor,
  initialHasMore,
  soldOutLabel,
  loadMoreLabel,
  loadingLabel,
}: {
  baseParams: ProductSearchParams
  initialCursor: string | null
  initialHasMore: boolean
  soldOutLabel: string
  loadMoreLabel: string
  loadingLabel: string
}) {
  const [items, setItems] = useState<ProductHit[]>([])
  const [cursor, setCursor] = useState(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)

  async function handleLoadMore() {
    if (!cursor || loading) {
      return
    }
    setLoading(true)
    try {
      const result = await loadMoreProducts({ ...baseParams, cursor })
      setItems((previous) => [...previous, ...result.products])
      setCursor(result.next_cursor)
      setHasMore(result.has_more)
    } finally {
      setLoading(false)
    }
  }

  if (!items.length && !hasMore) {
    return null
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {items.length > 0 && (
        <ProductGrid>
          {items.map((item) => (
            <ProductCardItem key={item.productCode} item={item} soldOutLabel={soldOutLabel} />
          ))}
        </ProductGrid>
      )}
      {hasMore && (
        <Button
          type="button"
          variant="secondary"
          onClick={handleLoadMore}
          loading={loading}
          className="mx-auto"
        >
          {loading ? loadingLabel : loadMoreLabel}
        </Button>
      )}
    </div>
  )
}
