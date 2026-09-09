/**
 * Seller-entered prices are wholesale/base prices. Customers see one final
 * retail price with Bawi's markup already included; no fee/commission line
 * is exposed to either party.
 */
export function addCustomerMarkup(baseAmount: number, markupBasisPoints: number): number {
  return Math.round((baseAmount * (10_000 + markupBasisPoints)) / 10_000)
}

/** Splits a retail subtotal back into the seller amount and Bawi markup. */
export function splitCustomerPrice(retailAmount: number, markupBasisPoints: number) {
  const sellerAmount = Math.round((retailAmount * 10_000) / (10_000 + markupBasisPoints))
  return { sellerAmount, markupAmount: retailAmount - sellerAmount }
}
