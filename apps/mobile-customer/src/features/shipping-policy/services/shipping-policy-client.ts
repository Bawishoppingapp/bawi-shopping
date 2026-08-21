const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export interface ShippingPolicy {
  standardShippingFeeCents: number;
  freeShippingThresholdCents: number;
  returnWindowDays: number;
}

// Module-level cache, not per-screen state: these business-config values
// change rarely (admin-edited), so every product detail screen sharing
// one fetch per app session avoids a request per product view - see
// docs/COST-REVIEW.md question 10 ("prevent mobile apps from causing
// excessive backend requests").
let cached: Promise<ShippingPolicy | null> | null = null;

async function fetchShippingPolicy(): Promise<ShippingPolicy | null> {
  try {
    const response = await fetch(`${MEDUSA_BACKEND_URL}/shipping-policy`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      standardShippingFeeCents: data.standard_shipping_fee_cents,
      freeShippingThresholdCents: data.free_shipping_threshold_cents,
      returnWindowDays: data.return_window_days,
    };
  } catch {
    return null;
  }
}

/** Public, unauthenticated - see apps/backend/src/api/shipping-policy/route.ts. */
export function getShippingPolicy(): Promise<ShippingPolicy | null> {
  if (!cached) {
    cached = fetchShippingPolicy().then((result) => {
      // Don't cache a failure - a transient network error shouldn't
      // permanently suppress this section for the rest of the app session.
      if (result === null) cached = null;
      return result;
    });
  }
  return cached;
}
