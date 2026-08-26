import {
  addCartItem,
  getCart,
  mergeGuestCartIntoCustomerCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../services/cart-client";

describe("cart-client", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cart: { id: "cart_1", items: [] } }),
    });
  });

  test("getCart sends x-cart-id when a cart id is provided", async () => {
    await getCart("cart_1", null);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/store/cart"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-cart-id": "cart_1" }),
      })
    );
  });

  test("getCart omits x-cart-id and Authorization when both are absent", async () => {
    await getCart(null, null);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers["x-cart-id"]).toBeUndefined();
    expect(options.headers.Authorization).toBeUndefined();
  });

  test("addCartItem posts variant_id and quantity", async () => {
    await addCartItem(null, "variant_1", 2, "token");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/store/cart/items"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ variant_id: "variant_1", quantity: 2 }),
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    );
  });

  test("updateCartItemQuantity PATCHes the line item", async () => {
    await updateCartItemQuantity("cart_1", "item_1", 3, "token");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/store/cart/items/item_1"),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ quantity: 3 }) })
    );
  });

  test("removeCartItem DELETEs the line item", async () => {
    await removeCartItem("cart_1", "item_1", "token");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/store/cart/items/item_1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("mergeGuestCartIntoCustomerCart posts the guest cart id, requires a token", async () => {
    await mergeGuestCartIntoCustomerCart("guest_cart_1", "token");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/store/cart/merge"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ guest_cart_id: "guest_cart_1" }),
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    );
  });

  test("throws when the response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 409 });
    await expect(getCart("cart_1", null)).rejects.toThrow("Cart request failed (409)");
  });
});
