import { listBrands, listCategories, searchProducts } from "../services/discovery-client";

describe("discovery-client", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  test("listCategories includes the locale query param", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ categories: [] }),
    });
    await listCategories("am");
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/categories?locale=am"));
  });

  test("listCategories throws on a non-ok response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    await expect(listCategories("en-US")).rejects.toThrow("Failed to load categories (500)");
  });

  test("listBrands throws on a non-ok response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    await expect(listBrands()).rejects.toThrow("Failed to load brands (500)");
  });

  describe("searchProducts", () => {
    test("only includes params that were actually provided", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ products: [], next_cursor: null, has_more: false, facets: { sizes: [], colors: [] } }),
      });

      await searchProducts({ brand: "acme", limit: 8 });

      const [url] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain("brand=acme");
      expect(url).toContain("limit=8");
      expect(url).not.toContain("q=");
      expect(url).not.toContain("category=");
    });

    test("serializes price_min/price_max from priceMin/priceMax", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ products: [], next_cursor: null, has_more: false, facets: { sizes: [], colors: [] } }),
      });

      await searchProducts({ priceMin: 1000, priceMax: 5000 });

      const [url] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain("price_min=1000");
      expect(url).toContain("price_max=5000");
    });

    test("throws on a non-ok response", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
      await expect(searchProducts({})).rejects.toThrow("Failed to load products (500)");
    });
  });
});
