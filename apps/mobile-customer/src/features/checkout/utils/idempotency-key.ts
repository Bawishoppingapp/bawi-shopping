// A stable-per-attempt id, not a cryptographic identifier - only needs to
// be unique enough that two different checkout attempts never collide.
// Avoids adding an expo-crypto dependency for something this small.
export function generateIdempotencyKey(): string {
  return `mobile-checkout-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
