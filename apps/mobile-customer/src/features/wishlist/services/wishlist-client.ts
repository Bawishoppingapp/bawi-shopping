import { createRequestCache } from "@/lib/request-cache";

import type { ProductHit } from "@/features/discovery/services/discovery-client";

// Mirrors apps/backend/src/api/store/wishlist/* exactly - the response's
// `products` are already shaped like ProductHit (imported, not
// redeclared - the backend's resolveWishlistHits() emits the exact same
// ProductSearchHit shape the discovery search endpoint does).
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

function authHeaders(sessionToken: string | null): Record<string, string> | null {
  if (!sessionToken) return null;
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${sessionToken}`,
  };
}

export const wishlistCache = createRequestCache<ProductHit[]>(30_000, 12);
export function readWishlist(sessionToken: string | null, locale: string, force = false) {
  if (!sessionToken) return Promise.resolve([]);
  return wishlistCache.get(JSON.stringify([sessionToken, locale]), () => fetchWishlist(sessionToken, locale, true), force);
}

export function listWishlist(sessionToken: string | null, locale?: string): Promise<ProductHit[]> {
  return fetchWishlist(sessionToken, locale, false);
}

async function fetchWishlist(sessionToken: string | null, locale: string | undefined, strict: boolean): Promise<ProductHit[]> {
  const headers = authHeaders(sessionToken);
  if (!headers) return [];

  const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/wishlist${query}`, { headers });
  if (!response.ok) {
    if (strict) throw new Error(`Failed to load wishlist (${response.status})`);
    return [];
  }

  const data = await response.json();
  return data.products as ProductHit[];
}

export async function addToWishlist(productCode: string, sessionToken: string | null): Promise<boolean> {
  const headers = authHeaders(sessionToken);
  if (!headers) return false;

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/wishlist`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ product_code: productCode }),
  });
  if (response.ok) wishlistCache.clear();
  return response.ok;
}

export async function removeFromWishlist(productCode: string, sessionToken: string | null): Promise<boolean> {
  const headers = authHeaders(sessionToken);
  if (!headers) return false;

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/wishlist/${encodeURIComponent(productCode)}`, {
    method: "DELETE",
    headers,
  });
  if (response.ok) wishlistCache.clear();
  return response.ok;
}
