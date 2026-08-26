import { getPublicProduct } from "../services/products-client";

describe("products-client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("returns the product on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ product: { product_code: "abc", currency_code: "etb" } }),
    });
    const result = await getPublicProduct("abc");
    expect(result).toEqual({ product_code: "abc", currency_code: "etb" });
  });

  test("appends the locale query param when provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({ product: null }) });
    await getPublicProduct("abc", "am");
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/products/abc?locale=am"));
  });

  test("omits the query string when no locale is provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => Promise.resolve({ product: null }) });
    await getPublicProduct("abc");
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.endsWith("/products/abc")).toBe(true);
  });

  test("returns null on a non-ok response instead of throwing", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const result = await getPublicProduct("missing");
    expect(result).toBeNull();
  });
});
