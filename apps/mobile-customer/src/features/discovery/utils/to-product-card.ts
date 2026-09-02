import type { ProductCardData } from "@bawi/mobile-ui";

import type { ProductHit } from "../services/discovery-client";
import { priceRangeLabel } from "./format-price";

export function toProductCardData(
  item: ProductHit,
  t?: (key: "product.noImage" | "product.soldOut") => string,
  formatPrice?: (minorUnits: number, currencyCode: string | null) => string,
): ProductCardData {
  const priceLabel = !formatPrice
    ? priceRangeLabel(item)
    : item.priceMin === null
      ? ""
      : item.priceMax !== null && item.priceMax !== item.priceMin
        ? `${formatPrice(item.priceMin, item.currencyCode)} – ${formatPrice(item.priceMax, item.currencyCode)}`
        : formatPrice(item.priceMin, item.currencyCode);
  return {
    id: item.productCode,
    title: item.title,
    brandName: item.brand,
    imageUrl: item.thumbnail ?? undefined,
    priceLabel,
    soldOut: !item.available,
    noImageLabel: t?.("product.noImage"),
    soldOutLabel: t?.("product.soldOut"),
  };
}
