// Prices are USD cents throughout, same convention as apps/mobile-customer.
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
