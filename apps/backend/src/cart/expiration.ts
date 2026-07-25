/**
 * Pure calculation, no I/O. A cart untouched for longer than the
 * configured window is treated as abandoned - callers start a fresh cart
 * transparently rather than reusing stale line items/prices. The old cart
 * row is never deleted (useful for analytics/support later); it's simply
 * no longer resolved from the guest/customer's cookie or customer_id.
 */
export function isCartExpired(updatedAt: Date, now: Date, expirationDays: number): boolean {
  const ageMs = now.getTime() - updatedAt.getTime()
  return ageMs > expirationDays * 24 * 60 * 60 * 1000
}
