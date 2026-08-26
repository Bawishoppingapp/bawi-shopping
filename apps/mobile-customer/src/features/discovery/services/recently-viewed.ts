import * as SecureStore from "expo-secure-store";

import type { ProductHit } from "./discovery-client";

// Device-local only, same reasoning as search-history.ts. Stores the
// same ProductHit shape the discovery endpoints already return, so the
// empty-search screen can render these with zero extra fetches or
// mapping - not just a list of codes needing a re-fetch.
const RECENTLY_VIEWED_KEY = "bawi_recently_viewed";
const MAX_RECENTLY_VIEWED = 12;

export async function getRecentlyViewed(): Promise<ProductHit[]> {
  const raw = await SecureStore.getItemAsync(RECENTLY_VIEWED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordProductView(product: ProductHit): Promise<void> {
  const existing = await getRecentlyViewed();
  const next = [product, ...existing.filter((p) => p.productCode !== product.productCode)].slice(
    0,
    MAX_RECENTLY_VIEWED
  );
  await SecureStore.setItemAsync(RECENTLY_VIEWED_KEY, JSON.stringify(next));
}
