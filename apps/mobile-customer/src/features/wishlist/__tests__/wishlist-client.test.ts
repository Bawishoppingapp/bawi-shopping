import { addToWishlist, listWishlist, removeFromWishlist } from "../services/wishlist-client";

describe("wishlist-client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  describe("listWishlist", () => {
    test("returns an empty list without calling fetch when logged out", async () => {
      const result = await listWishlist(null);
      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("returns the products array on success", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ products: [{ productCode: "abc" }] }),
      });
      const result = await listWishlist("token");
      expect(result).toEqual([{ productCode: "abc" }]);
    });
  });

  describe("addToWishlist", () => {
    test("returns false without calling fetch when logged out", async () => {
      const result = await addToWishlist("abc", null);
      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("posts the product_code and returns whether the response was ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const result = await addToWishlist("abc", "token");
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/wishlist"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ product_code: "abc" }),
        })
      );
    });

    test("returns false when the request fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const result = await addToWishlist("abc", "token");
      expect(result).toBe(false);
    });
  });

  describe("removeFromWishlist", () => {
    test("DELETEs the encoded product code", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const result = await removeFromWishlist("abc/def", "token");
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/wishlist/abc%2Fdef"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
