import { createRequestCache } from "@/lib/request-cache";

import * as SecureStore from "expo-secure-store";

import { getPublicProduct } from "@/features/products/services/products-client";
import type { ProductHit } from "./discovery-client";

// Device-local only, same reasoning as search-history.ts. Stores the
// same ProductHit shape the discovery endpoints already return, so the
// empty-search screen can render these with zero extra fetches or
// mapping - not just a list of codes needing a re-fetch.
const RECENTLY_VIEWED_KEY = "bawi_recently_viewed";
const MAX_RECENTLY_VIEWED = 12;
const storedHistory = createRequestCache<ProductHit[]>(24 * 60 * 60_000, 1);
const localizedHistory = createRequestCache<ProductHit[]>(60_000, 12);

export async function getRecentlyViewed(locale?: string): Promise<ProductHit[]> {
  try {
    const items = await storedHistory.get(RECENTLY_VIEWED_KEY, async () => {
      const raw = await SecureStore.getItemAsync(RECENTLY_VIEWED_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTLY_VIEWED) as ProductHit[] : [];
    });
    if (items.length === 0) return [];
    if (!locale) return items;
    // Saved titles belong to the language used when viewing the product.
    // Resolve fresh approved translations instead of displaying stale English.
    return await localizedHistory.get(JSON.stringify([locale, items]), async () => {
    const products = await Promise.all(items.map(async (item) => {
      const product = await getPublicProduct(item.productCode, locale);
      return product ? { ...item, title: product.title, thumbnail: product.thumbnail } : null;
    }));
    return products.filter((item): item is ProductHit => item !== null);
    });
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
  storedHistory.clear();
  localizedHistory.clear();
}

/** Removes a product that the public catalog no longer exposes. This keeps
 * an archived/rejected/deleted listing from lingering as a tappable local
 * card after the backend has correctly stopped serving its detail page. */
export async function removeRecentlyViewedProduct(productCode: string): Promise<void> {
  const existing = await getRecentlyViewed();
  const next = existing.filter((product) => product.productCode !== productCode);
  await SecureStore.setItemAsync(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  storedHistory.clear();
  localizedHistory.clear();
}

export async function clearRecentlyViewed(): Promise<void> {
  await SecureStore.deleteItemAsync(RECENTLY_VIEWED_KEY);
  storedHistory.clear();
  localizedHistory.clear();
}
