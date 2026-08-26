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

export async function listWishlist(sessionToken: string | null): Promise<ProductHit[]> {
  const headers = authHeaders(sessionToken);
  if (!headers) return [];

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/wishlist`, { headers });
  if (!response.ok) return [];

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
  return response.ok;
}

export async function removeFromWishlist(productCode: string, sessionToken: string | null): Promise<boolean> {
  const headers = authHeaders(sessionToken);
  if (!headers) return false;

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/wishlist/${encodeURIComponent(productCode)}`, {
    method: "DELETE",
    headers,
  });
  return response.ok;
}
