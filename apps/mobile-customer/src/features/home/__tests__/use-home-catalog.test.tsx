import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { categoryCache } from "@/features/discovery/services/discovery-client";
import { arrivalsCache, useHomeCatalog } from "../hooks/use-home-catalog";

const response = (data: unknown) => ({ ok: true, json: async () => data });
const catalog = { products: [{ productCode: "one" }], has_more: false, next_cursor: null, facets: { sizes: [], colors: [] } };

beforeEach(() => {
  categoryCache.clear();
  arrivalsCache.clear();
  jest.mocked(useFocusEffect).mockImplementation((callback) => useEffect(callback, [callback]));
  globalThis.fetch = jest.fn();
});

test("shows categories while products are still pending and makes no shipping request", async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(fetch).mockImplementation((url) => String(url).includes("/categories")
    ? Promise.resolve(response({ categories: [{ id: "shirts" }] }) as Response)
    : new Promise((done) => { resolve = done as typeof resolve; }));
  const { result } = await renderHook(() => useHomeCatalog("en-US"));
  await waitFor(() => expect(result.current.categories).toEqual([{ id: "shirts" }]));
  expect(result.current.catalog).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(jest.mocked(fetch).mock.calls.some(([url]) => String(url).includes("shipping"))).toBe(false);
  await act(async () => { resolve(response(catalog)); });
  expect(result.current.catalog).toEqual(catalog);
});

test("remounts with cached data, refreshes explicitly, and retains products offline", async () => {
  jest.mocked(fetch).mockImplementation(async (url) => response(String(url).includes("categories") ? { categories: [] } : catalog) as Response);
  const first = await renderHook(() => useHomeCatalog("en-US"));
  await waitFor(() => expect(first.result.current.catalog).toEqual(catalog));
  await first.unmount();
  const second = await renderHook(() => useHomeCatalog("en-US"));
  expect(second.result.current.catalog).toEqual(catalog);
  expect(fetch).toHaveBeenCalledTimes(2);
  jest.mocked(fetch).mockRejectedValue(new Error("offline"));
  await act(async () => { await second.result.current.refresh(); });
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(second.result.current.catalog).toEqual(catalog);
  expect(second.result.current.error).toBe(true);
  expect(second.result.current.refreshing).toBe(false);
});

test("ignores old-language responses after a language change", async () => {
  let resolveOld!: (value: unknown) => void;
  jest.mocked(fetch).mockImplementation((url) => {
    if (String(url).includes("/products?") && String(url).includes("en-US")) return new Promise((done) => { resolveOld = done as typeof resolveOld; });
    return Promise.resolve(response(String(url).includes("categories") ? { categories: [] } : { ...catalog, products: [] }) as Response);
  });
  const view = await renderHook<ReturnType<typeof useHomeCatalog>, { locale: string }>(({ locale }) => useHomeCatalog(locale), { initialProps: { locale: "en-US" } });
  await view.rerender({ locale: "am" });
  await waitFor(() => expect(view.result.current.catalog?.products).toEqual([]));
  await act(async () => { resolveOld(response(catalog)); });
  expect(view.result.current.locale).toBe("am");
  expect(view.result.current.catalog?.products).toEqual([]);
});
