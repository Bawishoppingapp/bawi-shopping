import type { ProductCardData } from "@bawi/mobile-ui";

import type { ProductHit } from "../services/discovery-client";
import { priceRangeLabel } from "./format-price";

export function toProductCardData(item: ProductHit): ProductCardData {
  return {
    id: item.productCode,
    title: item.title,
    brandName: item.brand,
    imageUrl: item.thumbnail ?? undefined,
    priceLabel: priceRangeLabel(item),
    soldOut: !item.available,
  };
}
