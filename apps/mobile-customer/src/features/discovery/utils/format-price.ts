import type { ProductHit } from "../services/discovery-client";

/** Prices are stored/returned in USD cents throughout the backend -
 * matches apps/storefront's own formatUsd(). */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function priceRangeLabel(item: Pick<ProductHit, "priceMin" | "priceMax">): string {
  if (item.priceMin === null) {
    return "";
  }
  if (item.priceMax !== null && item.priceMax !== item.priceMin) {
    return `${formatUsd(item.priceMin)} – ${formatUsd(item.priceMax)}`;
  }
  return formatUsd(item.priceMin);
}
