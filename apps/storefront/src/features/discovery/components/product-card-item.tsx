import { ProductCard } from "@bawi/ui"
import type { ProductHit } from "../services/discovery-client"
import { priceRangeLabel } from "../utils/format-price"

export function ProductCardItem({ item, soldOutLabel }: { item: ProductHit; soldOutLabel: string }) {
  return (
    <ProductCard
      href={`/products/${item.productCode}`}
      imageUrl={item.thumbnail}
      title={item.title}
      brand={item.brand}
      priceLabel={priceRangeLabel(item)}
      soldOut={!item.available}
      soldOutLabel={soldOutLabel}
    />
  )
}
