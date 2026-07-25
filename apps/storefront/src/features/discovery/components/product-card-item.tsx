import { ProductCard } from "@bawi/ui"
import type { ProductHit } from "../services/discovery-client"

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function priceLabel(item: ProductHit): string {
  if (item.priceMin === null) {
    return ""
  }
  if (item.priceMax !== null && item.priceMax !== item.priceMin) {
    return `${formatUsd(item.priceMin)} – ${formatUsd(item.priceMax)}`
  }
  return formatUsd(item.priceMin)
}

export function ProductCardItem({ item, soldOutLabel }: { item: ProductHit; soldOutLabel: string }) {
  return (
    <ProductCard
      href={`/products/${item.productCode}`}
      imageUrl={item.thumbnail}
      title={item.title}
      brand={item.brand}
      priceLabel={priceLabel(item)}
      soldOut={!item.available}
      soldOutLabel={soldOutLabel}
    />
  )
}
