import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { categoryCache, listCategories, searchProducts, type CategoryNode, type ProductSearchResponse } from "@/features/discovery/services/discovery-client";
import { createRequestCache } from "@/lib/request-cache";

export const arrivalsCache = createRequestCache<ProductSearchResponse>(60_000, 12);

/** Categories and products settle independently; a slow request never hides
 * the other section. Same-language stale content survives refresh failures. */
export function useHomeCatalog(locale: string) {
  const [state, setState] = useState<{
    locale: string; categories?: CategoryNode[]; catalog?: ProductSearchResponse; error: boolean;
  }>(() => ({ locale, categories: categoryCache.peek(locale), catalog: arrivalsCache.peek(locale), error: false }));
  const [refreshing, setRefreshing] = useState(false);
  const version = useRef(0);
  const load = useCallback(async (force = false) => {
    const request = ++version.current;
    setState((previous) => previous.locale === locale ? { ...previous, error: false } : {
      locale, categories: categoryCache.peek(locale), catalog: arrivalsCache.peek(locale), error: false,
    });
    const update = (patch: Partial<typeof state>) => {
      if (request === version.current) setState((previous) => ({ ...previous, ...patch }));
    };
    await Promise.all([
      listCategories(locale, force).then((categories) => update({ categories })).catch(() => update({ error: true })),
      arrivalsCache.get(locale, () => searchProducts({ sort: "newest", limit: 16, locale }), force)
        .then((catalog) => update({ catalog })).catch(() => update({ error: true })),
    ]);
  }, [locale]);
  useFocusEffect(useCallback(() => {
    setRefreshing(false);
    void load();
    return () => { version.current++; };
  }, [load]));
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(true); } finally { setRefreshing(false); }
  }, [load]);
  const current = state.locale === locale ? state : {
    locale, categories: categoryCache.peek(locale), catalog: arrivalsCache.peek(locale), error: false,
  };
  return { ...current, refreshing, refresh };
}
