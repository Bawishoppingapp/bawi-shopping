import type { ProductHit } from "../services/discovery-client";

/** Prices are stored in each currency's minor unit (hundredths) throughout
 * the backend, same convention regardless of currency - see
 * apps/backend's Seller.currency_code and docs/DECISIONS.md's
 * Ethiopian-market entry. ETB shows as whole Birr (no decimal places,
 * matching retail-standard convention there) rather than USD's
 * cents-precision "$X.XX". */
export function formatMoney(cents: number, currencyCode: string | null): string {
  if (currencyCode === "etb") {
    return `Br ${Math.round(cents / 100).toLocaleString()}`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

/** USD-only convenience, for the handful of call sites that are still
 * genuinely USD-specific (e.g. business-config values that don't carry a
 * currency of their own). Prefer formatMoney wherever a real currencyCode
 * is available. */
export function formatUsd(cents: number): string {
  return formatMoney(cents, "usd");
}

export function priceRangeLabel(item: Pick<ProductHit, "priceMin" | "priceMax" | "currencyCode">): string {
  if (item.priceMin === null) {
    return "";
  }
  if (item.priceMax !== null && item.priceMax !== item.priceMin) {
    return `${formatMoney(item.priceMin, item.currencyCode)} – ${formatMoney(item.priceMax, item.currencyCode)}`;
  }
  return formatMoney(item.priceMin, item.currencyCode);
}
