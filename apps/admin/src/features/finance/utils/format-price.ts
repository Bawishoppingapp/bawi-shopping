/** Prices are stored in each currency's minor unit (hundredths) throughout
 * the backend, same convention regardless of currency - see
 * apps/backend's Seller.currency_code and docs/DECISIONS.md's
 * Ethiopian-market entry. ETB shows as whole Birr (no decimal places,
 * matching retail-standard convention there) rather than USD's
 * cents-precision "$X.XX". Mirrors the identical helper in every other
 * app in this monorepo. */
export function formatMoney(cents: number, currencyCode: string): string {
  if (currencyCode === "etb") {
    return `Br ${Math.round(cents / 100).toLocaleString()}`
  }
  return `$${(cents / 100).toFixed(2)}`
}
